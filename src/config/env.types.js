/**
 * @typedef {{ id: string, session: string }} MtprotoAccountConfig
 */

/**
 * @typedef {object} AppEnv
 * @property {string} nodeEnv
 * @property {number} port
 * @property {string} telegramBotToken
 * @property {number} telegramApiId
 * @property {string} telegramApiHash
 * @property {import('./mtprotoAccounts.js').MtprotoAccountConfig[]} mtprotoAccounts Loaded from config file or env JSON (see mtprotoAccounts.js)
 * @property {number} mtprotoMinSendIntervalMs Minimum spacing between sends on the same account
 * @property {number} idempotencyTtlMs How long idempotency keys are remembered
 * @property {string} serviceLogPath Absolute path to append-only JSON Lines log file
 * @property {boolean} logSkipHealth When true, skip logging GET / and GET /health
 */

export {};
