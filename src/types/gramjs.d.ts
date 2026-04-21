/** Minimal typings for GramJS (`telegram` npm package); runtime uses CommonJS via createRequire. */
declare module "telegram/errors" {
  export class FloodWaitError extends Error {
    seconds?: number;
    errorMessage?: string;
  }
  export class AuthKeyError extends Error {
    errorMessage?: string;
  }
}

declare module "telegram" {
  export interface TelegramClientStartOpts {
    phoneNumber?: () => Promise<string>;
    phoneCode?: () => Promise<string>;
    password?: (hint?: string) => Promise<string>;
    onError?: (err: unknown) => Promise<boolean>;
  }

  export class TelegramClient {
    constructor(
      session: unknown,
      apiId: number,
      apiHash: string,
      opts?: { connectionRetries?: number },
    );
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    isUserAuthorized(): Promise<boolean>;
    sendMessage(peer: unknown, opts: { message: string }): Promise<unknown>;
    start(opts: TelegramClientStartOpts): Promise<void>;
    session: { save(): string };
  }
}

declare module "telegram/sessions" {
  export class StringSession {
    constructor(session: string);
  }
}
