# Telegram link delivery backend

High-level overview of this service: how it fits together, what it can and cannot do, and how to run it.

For **end-to-end behavior**, sequence flows, and error matrices, see **[docs/TECHNICAL-GUIDE.md](docs/TECHNICAL-GUIDE.md)**.

## Purpose

Deliver a **URL and short text** to a Telegram user in two ways:

1. **Bot HTTP API** — your **bot** sends a private message (requires a BotFather token). Typical for products that already use a bot.
2. **MTProto (user session)** — your **own Telegram account** sends the message via [GramJS](https://github.com/gram-js/gramjs). Useful when a bot-only path is blocked or unsuitable, with different Telegram rules and risks.

In both cases the API **echoes the same `link` in the JSON response** so clients in **bot-restricted distribution contexts** can still show or copy the URL if the DM path fails.

This repository is a **POC backend**. It does not include a game client, database, or auth for who may call the API.

---

## Architecture (folders)

| Path | Role |
|------|------|
| `index.ts` / `dist/index.js` | Process entry: starts HTTP server. |
| `index.ts` | Loads `.env`, `loadEnv`, `createApp`, listens on `PORT`. |
| `src/app.ts` | Express app: CORS, JSON body, routes, 404, error handler. |
| `src/config/` | Environment types and `loadEnv()`. |
| `src/middleware/` | CORS helper. |
| `src/routes/` | HTTP route wiring (`health`, `telegram` deliver routes). |
| `src/controllers/` | Parse request body, map service result to HTTP JSON. |
| `src/services/` | **Bot** delivery (`telegramClient`, `telegramDeliverService`) and **MTProto** delivery (`mtprotoDeliverService`). |
| `scripts/mtproto-login.ts` | One-time interactive login; prints a session string to paste into `config/mtproto-accounts.json`. |

---

## HTTP API

Base URL (default): `http://localhost:4000`

### Health

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Short plain-text label. |
| `GET` | `/health` | Liveness check (`{ "ok": true }`). |

### Deliver link (bot)

| Method | Path | Auth (env) |
|--------|------|----------------|
| `POST` | `/api/telegram/deliver` | `TELEGRAM_BOT_TOKEN` |

**Body (JSON)**

| Field | Required | Description |
|--------|----------|-------------|
| `telegramUserId` | Yes | Numeric Telegram user id (string of digits). |
| `link` | Yes | URL (or any string) included in the message and echoed in the response. |
| `text` | No | Line shown above the link; default: `Here is your link.` |

**Notes**

- The recipient usually must have **opened the bot and pressed Start** once, or Telegram may refuse the DM (`delivered: false`).

### Deliver link (MTProto)

| Method | Path | Auth (env) |
|--------|------|----------------|
| `POST` | `/api/telegram/deliver-mtproto` | `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, sessions in `config/mtproto-accounts.json` |

**Body (JSON)** — same as bot, plus optional username.

| Field | Required | Description |
|--------|----------|-------------|
| `telegramUserId` | One of id or username | Numeric user id. |
| `telegramUsername` | One of id or username | Public username **without** `@`. Prefer this when the user is not already in your dialogs. |
| `link` | Yes | Same as bot route. |
| `text` | No | Same as bot route. |

If both `telegramUsername` and `telegramUserId` are sent, **username is used** for sending.

**Response extras (MTProto)**

- `transport`: `"mtproto"`
- On failure: optional `detail` (truncated Telegram error text).
- Optional `telegramAppDeepLink` when `link` is an `https://t.me/...` URL (for opening in the native Telegram app).

---

## Environment variables

Copy `.env.example` to `.env` and fill values. The server loads **`.env` from this project directory** (next to `package.json`).

| Variable | Used by | Description |
|----------|---------|-------------|
| `PORT` | Server | HTTP port (default `4000`). |
| `TELEGRAM_BOT_TOKEN` | `/api/telegram/deliver` | Bot token from [@BotFather](https://t.me/BotFather). |
| `TELEGRAM_API_ID` | MTProto | Integer from [my.telegram.org/apps](https://my.telegram.org/apps). |
| `TELEGRAM_API_HASH` | MTProto | String from the same page. |
| `TELEGRAM_MTPROTO_ACCOUNTS_FILE` | MTProto | Optional path to a JSON account list (defaults to `config/mtproto-accounts.json`). |
| `TELEGRAM_MTPROTO_ACCOUNTS_JSON` | MTProto | Optional inline JSON account array (e.g. Docker). |
| `CORS_ORIGIN` | CORS middleware | Optional; defaults to `*`. |

Never commit `.env` or real session strings. The repo may ship **dummy** placeholders in `config/mtproto-accounts.json`; replace them after login.

---

## MTProto: first-time login

1. Put `TELEGRAM_API_ID` and `TELEGRAM_API_HASH` in `.env`.
2. Run: `npm run mtproto:login`
3. Enter phone, login code, and cloud password if prompted.
4. Paste the printed session into **`config/mtproto-accounts.json`** under the right `"id"` (replace dummy values).
5. Restart the server.

---

## Limitations and compliance

- **Bot route:** Telegram controls who a bot may message; cold DMs to arbitrary ids often fail until the user has started the bot.
- **MTProto route:** Numeric ids often fail with **“Could not find the input entity”** unless that user is already a **known peer** (dialogs, contacts, etc.). Prefer **`telegramUsername`** when possible. See [Telethon: Entities](https://docs.telethon.dev/en/stable/concepts/entities.html) for the same underlying MTProto idea.
- **Terms of Service:** Automated or bulk messaging with a **user** account can violate [Telegram ToS](https://telegram.org/tos). Use only for legitimate, low-volume flows you are allowed to run.
- **Security:** MTProto session strings are equivalent to login cookies; protect `config/mtproto-accounts.json` and `.env` like credentials.

---

## Run locally

```bash
cd backend
npm install
cp .env.example .env   # Windows: copy .env.example .env
# edit .env
npm run dev
```

TypeScript is compiled to `dist/`. Production-style (no file watcher) after a build:

```bash
npm run build
npm run start:prod
```

---

## Example payloads (Postman)

**Bot —** `POST /api/telegram/deliver`

```json
{
  "telegramUserId": "123456789",
  "link": "https://example.com/page",
  "text": "Your link"
}
```

**MTProto by username —** `POST /api/telegram/deliver-mtproto`

```json
{
  "telegramUsername": "username_without_at",
  "link": "https://example.com/page",
  "text": "Your link"
}
```

**MTProto by user id —** same path, use when the peer is already known to your session:

```json
{
  "telegramUserId": "123456789",
  "link": "https://example.com/page",
  "text": "Your link"
}
```

---

## Dependencies (summary)

- **express** — HTTP API  
- **dotenv** — Load `.env`  
- **telegram** (GramJS) — MTProto client  
- **big-integer** — Safe Telegram user ids for GramJS  
- **typescript** / **tsx** — TypeScript build and dev (watch) runs

---

## Future work (not in this POC)

- Authenticate callers (API keys, JWT, etc.).
- Rate limits and audit logs.
- Persist sessions and delivery state in a database.
- Webhooks or queues instead of synchronous `sendMessage` only.
