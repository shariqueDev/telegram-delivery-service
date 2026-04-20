import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");

export class MtprotoAccountSession {
  /**
   * @param {string} id
   * @param {string} sessionString
   * @param {number} apiId
   * @param {string} apiHash
   * @param {number} minSendIntervalMs
   */
  constructor(id, sessionString, apiId, apiHash, minSendIntervalMs) {
    this.id = id;
    this._sessionString = sessionString;
    this._apiId = apiId;
    this._apiHash = apiHash;
    this.minSendIntervalMs = minSendIntervalMs;

    /** @type {import('telegram').TelegramClient | null} */
    this._client = null;
    /** @type {'healthy' | 'disabled'} */
    this.status = "healthy";
    /** @type {number} */
    this.floodWaitUntil = 0;
    /** @type {number} */
    this.lastUsedAt = 0;
    /** @type {number} */
    this._lastSendEnd = 0;
    /** @type {string | null} */
    this.disabledReason = null;

    this._lock = Promise.resolve();
  }

  isSelectable() {
    if (this.status === "disabled") return false;
    if (Date.now() < this.floodWaitUntil) return false;
    return true;
  }

  isInFloodWait() {
    return Date.now() < this.floodWaitUntil;
  }

  /**
   * @param {number} seconds
   */
  markFloodWait(seconds) {
    this.floodWaitUntil = Date.now() + seconds * 1000;
  }

  /**
   * @param {string} [reason]
   */
  async markDisabled(reason) {
    this.status = "disabled";
    this.disabledReason = reason ?? "disabled";
    if (this._client) {
      try {
        await this._client.disconnect();
      } catch {
        /* ignore */
      }
      this._client = null;
    }
  }

  /**
   * @template T
   * @param {() => Promise<T>} fn
   * @returns {Promise<T>}
   */
  async withLock(fn) {
    const run = this._lock.then(() => fn());
    this._lock = run.catch(() => {}).then(() => {});
    return run;
  }

  async _ensureSpacing() {
    const now = Date.now();
    const wait = this._lastSendEnd + this.minSendIntervalMs - now;
    if (wait > 0) {
      await new Promise((r) => setTimeout(r, wait));
    }
  }

  _touchSend() {
    this._lastSendEnd = Date.now();
    this.lastUsedAt = this._lastSendEnd;
  }

  async _getClient() {
    if (this.status === "disabled") {
      throw new Error("ACCOUNT_DISABLED");
    }
    if (!this._client) {
      const session = new StringSession(this._sessionString);
      this._client = new TelegramClient(session, this._apiId, this._apiHash, {
        connectionRetries: 5,
      });
      await this._client.connect();
      if (!(await this._client.isUserAuthorized())) {
        await this._client.disconnect();
        this._client = null;
        await this.markDisabled("unauthorized");
        const e = new Error("SESSION_UNAUTHORIZED");
        e.errorMessage = "SESSION_UNAUTHORIZED";
        throw e;
      }
    }
    return this._client;
  }

  /**
   * @param {string | import('big-integer').BigInteger} peer
   * @param {string} message
   */
  async sendMessage(peer, message) {
    return this.withLock(async () => {
      if (this.status === "disabled") {
        throw new Error("ACCOUNT_DISABLED");
      }
      await this._ensureSpacing();
      const client = await this._getClient();
      await client.sendMessage(peer, { message });
      this._touchSend();
    });
  }
}
