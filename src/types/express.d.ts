declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
    interface Locals {
      _accessLogJsonBody?: unknown;
    }
  }
}

export {};
