const TG_API = "https://api.telegram.org";

export interface SendMessageOpts {
  disableWebPagePreview?: boolean;
}

export interface TelegramApiResponse {
  ok?: boolean;
  description?: string;
  error_code?: number;
}

export class TelegramSendMessageError extends Error {
  telegramDescription?: string;
  telegramErrorCode?: number;

  constructor(message: string, opts?: { description?: string; errorCode?: number }) {
    super(message);
    this.name = "TelegramSendMessageError";
    this.telegramDescription = opts?.description;
    this.telegramErrorCode = opts?.errorCode;
  }
}

export async function sendTelegramMessage(
  botToken: string,
  chatId: number | string,
  text: string,
  opts: SendMessageOpts = {},
): Promise<TelegramApiResponse> {
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

  const data = (await res.json().catch(() => ({}))) as TelegramApiResponse;
  if (!res.ok || !data.ok) {
    const desc = data?.description ?? res.statusText;
    throw new TelegramSendMessageError(`Telegram sendMessage failed: ${desc}`, {
      description: desc,
      errorCode: data?.error_code,
    });
  }
  return data;
}

/**
 * Opens the bot in the installed Telegram app (useful when `https://t.me/...`
 * is blocked inside an in-game WebView in certain distribution markets).
 */
export function buildTelegramAppDeepLink(botUsername: string, startPayload: string): string {
  const user = botUsername.replace(/^@/, "");
  const qs = new URLSearchParams({ domain: user, start: String(startPayload) });
  return `tg://resolve?${qs.toString()}`;
}

/**
 * If `httpsUrl` is a `t.me` / `telegram.me` deep link, returns a `tg://resolve?...` URL
 * for opening the same destination in the installed Telegram app.
 */
export function tryTelegramAppDeepLinkForHttpsTmeUrl(httpsUrl: string): string | null {
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
