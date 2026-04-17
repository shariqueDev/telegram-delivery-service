/**
 * @param {ReturnType<import('../services/mtprotoDeliverService.js').createMtprotoDeliverService>} mtprotoDeliverService
 */
export function createMtprotoDeliverController(mtprotoDeliverService) {
  return {
    async deliver(req, res) {
      const { telegramUserId, telegramUsername, link, text } = req.body ?? {};

      const result = await mtprotoDeliverService.deliverLink({
        telegramUserId,
        telegramUsername,
        link,
        text,
      });

      if (!result.ok) {
        res.status(result.httpStatus).json({ ok: false, error: result.error });
        return;
      }

      res.status(200).json({
        ok: true,
        delivered: result.delivered,
        transport: result.transport,
        link: result.link,
        ...(result.telegramUsername ? { telegramUsername: result.telegramUsername } : {}),
        ...(result.telegramUserId ? { telegramUserId: result.telegramUserId } : {}),
        ...(result.telegramAppDeepLink ? { telegramAppDeepLink: result.telegramAppDeepLink } : {}),
        ...(result.detail ? { detail: result.detail } : {}),
        message: result.message,
      });
    },
  };
}
