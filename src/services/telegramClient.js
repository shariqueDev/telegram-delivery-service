const TG_API = "https://api.telegram.org";

/**
 * @param {string} botToken
 * @param {number|string} chatId
 * @param {string} text
 * @param {{ disableWebPagePreview?: boolean }} [opts]
 */
export async function sendTelegramMessage(botToken, chatId, text, opts = {}) {
  const url = `${TG_API}/bot${botToken}/sendMessage`;
  const body = {
    chat_id: chatId,
    text,
    disable_web_page_preview: opts.disableWebPagePreview ?? true,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    const desc = data?.description ?? res.statusText;
    const err = new Error(`Telegram sendMessage failed: ${desc}`);
    err.telegramDescription = desc;
    err.telegramErrorCode = data?.error_code;
    throw err;
  }
  return data;
}

/**
 * Opens the bot in the installed Telegram app (useful when `https://t.me/...`
 * is blocked inside an in-game WebView in certain distribution markets).
 * @param {string} botUsername without @
 * @param {string} startPayload
 */
export function buildTelegramAppDeepLink(botUsername, startPayload) {
  const user = botUsername.replace(/^@/, "");
  const qs = new URLSearchParams({ domain: user, start: String(startPayload) });
  return `tg://resolve?${qs.toString()}`;
}

/**
 * If `httpsUrl` is a `t.me` / `telegram.me` deep link, returns a `tg://resolve?...` URL
 * for opening the same destination in the installed Telegram app.
 * @param {string} httpsUrl
 * @returns {string|null}
 */
export function tryTelegramAppDeepLinkForHttpsTmeUrl(httpsUrl) {
  try {
    const u = new URL(String(httpsUrl).trim());
    if (u.protocol !== "https:") return null;
    const host = u.hostname.toLowerCase();
    if (host !== "t.me" && host !== "telegram.me") return null;
    const segments = u.pathname.split("/").filter(Boolean);
    const domain = segments[0];
    if (!domain) return null;
    const start = u.searchParams.get("start") ?? "";
    return buildTelegramAppDeepLink(domain, start);
  } catch {
    return null;
  }
}
