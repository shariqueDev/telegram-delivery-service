import type { Request, Response } from "express";
import type { MtprotoDeliverService } from "../services/mtprotoDeliverService.js";

export function createMtprotoDeliverController(mtprotoDeliverService: MtprotoDeliverService) {
  return {
    async deliver(req: Request, res: Response): Promise<void> {
      const { telegramUserId, telegramUsername, link, text, messageId } = (req.body ?? {}) as Record<
        string,
        unknown
      >;

      const result = await mtprotoDeliverService.deliverLink({
        telegramUserId,
        telegramUsername,
        link,
        text,
        messageId,
      });

      if (!result.ok) {
        res.status(result.httpStatus).json({ ok: false, error: result.error, requestId: req.requestId });
        return;
      }

      const r = result as Record<string, unknown>;

      res.status(200).json({
        ok: true,
        requestId: req.requestId,
        ...(r.idempotentReplay ? { idempotentReplay: true } : {}),
        delivered: r.delivered,
        transport: r.transport,
        ...(r.accountId != null ? { accountId: r.accountId } : {}),
        ...(Array.isArray(r.attemptsByAccount) && (r.attemptsByAccount as unknown[]).length > 0
          ? { attemptsByAccount: r.attemptsByAccount }
          : {}),
        ...(r.attempts != null ? { attempts: r.attempts } : {}),
        ...(r.reason != null && r.reason !== undefined ? { reason: r.reason } : {}),
        link: r.link,
        ...(r.telegramUsername ? { telegramUsername: r.telegramUsername } : {}),
        ...(r.telegramUserId ? { telegramUserId: r.telegramUserId } : {}),
        ...(r.telegramAppDeepLink ? { telegramAppDeepLink: r.telegramAppDeepLink } : {}),
        ...(r.detail ? { detail: r.detail } : {}),
        message: r.message,
      });
    },
  };
}
