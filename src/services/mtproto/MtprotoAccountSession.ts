import { createRequire } from "node:module";
import type { BigInteger } from "big-integer";

const require = createRequire(import.meta.url);
const { TelegramClient } = require("telegram") as typeof import("telegram");
const { StringSession } = require("telegram/sessions") as typeof import("telegram/sessions");

export type PeerArg = string | BigInteger;

export class MtprotoAccountSession {
  readonly id: string;
  private readonly _sessionString: string;
  private readonly _apiId: number;
  private readonly _apiHash: string;
  readonly minSendIntervalMs: number;

  private _client: InstanceType<typeof TelegramClient> | null = null;
  status: "healthy" | "disabled" = "healthy";
  floodWaitUntil = 0;
  lastUsedAt = 0;
  private _lastSendEnd = 0;
  disabledReason: string | null = null;

  private _lock: Promise<void> = Promise.resolve();

  constructor(id: string, sessionString: string, apiId: number, apiHash: string, minSendIntervalMs: number) {
    this.id = id;
    this._sessionString = sessionString;
    this._apiId = apiId;
    this._apiHash = apiHash;
    this.minSendIntervalMs = minSendIntervalMs;
  }

  isSelectable(): boolean {
    if (this.status === "disabled") return false;
    if (Date.now() < this.floodWaitUntil) return false;
    return true;
  }

  isInFloodWait(): boolean {
    return Date.now() < this.floodWaitUntil;
  }

  markFloodWait(seconds: number): void {
    this.floodWaitUntil = Date.now() + seconds * 1000;
  }

  async markDisabled(reason?: string): Promise<void> {
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

  async withLock<T>(fn: () => Promise<T>): Promise<T> {
    const run = this._lock.then(() => fn());
    this._lock = run.catch(() => {}).then(() => {});
    return run;
  }

  private async _ensureSpacing(): Promise<void> {
    const now = Date.now();
    const wait = this._lastSendEnd + this.minSendIntervalMs - now;
    if (wait > 0) {
      await new Promise<void>((r) => setTimeout(r, wait));
    }
  }

  private _touchSend(): void {
    this._lastSendEnd = Date.now();
    this.lastUsedAt = this._lastSendEnd;
  }

  private async _getClient(): Promise<InstanceType<typeof TelegramClient>> {
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
        const e = new Error("SESSION_UNAUTHORIZED") as Error & { errorMessage?: string };
        e.errorMessage = "SESSION_UNAUTHORIZED";
        throw e;
      }
    }
    return this._client;
  }

  async sendMessage(peer: PeerArg, message: string): Promise<void> {
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
