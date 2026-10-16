import { AccessTokenPayload } from '../utils/token.util';

declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
      cookies: Record<string, string | undefined>;
      signedCookies: Record<string, string | undefined>;
    }
  }
}
