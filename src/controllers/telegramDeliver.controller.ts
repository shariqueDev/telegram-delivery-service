import type { Request, Response } from "express";
import type { TelegramDeliverService } from "../services/telegramDeliverService.js";

export function createTelegramDeliverController(telegramDeliverService: TelegramDeliverService) {
  return {
    async deliver(req: Request, res: Response): Promise<void> {
      const { telegramUserId, link, text } = (req.body ?? {}) as Record<string, unknown>;

      const result = await telegramDeliverService.deliverLink({
        telegramUserId,
        link,
        text,
      });

      if (!result.ok) {
        res.status(result.httpStatus).json({ ok: false, error: result.error, requestId: req.requestId });
        return;
      }

      res.status(200).json({
        ok: true,
        requestId: req.requestId,
        delivered: result.delivered,
        link: result.link,
        ...(result.telegramAppDeepLink ? { telegramAppDeepLink: result.telegramAppDeepLink } : {}),
        message: result.message,
      });
    },
  };
}
