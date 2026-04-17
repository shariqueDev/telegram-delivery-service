/**
 * @param {ReturnType<import('../services/telegramDeliverService.js').createTelegramDeliverService>} telegramDeliverService
 */
export function createTelegramDeliverController(telegramDeliverService) {
  return {
    async deliver(req, res) {
      const { telegramUserId, link, text } = req.body ?? {};

      const result = await telegramDeliverService.deliverLink({
        telegramUserId,
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
        link: result.link,
        ...(result.telegramAppDeepLink ? { telegramAppDeepLink: result.telegramAppDeepLink } : {}),
        message: result.message,
      });
    },
  };
}
