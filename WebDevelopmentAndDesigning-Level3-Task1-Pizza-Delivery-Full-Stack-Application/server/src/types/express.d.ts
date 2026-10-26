import type { AuthUser } from './index';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      /** Parsed + validated input populated by the `validate` middleware. */
      validated: { body?: any; query?: any; params?: any };
      requestId?: string;
    }
  }
}

export {};
