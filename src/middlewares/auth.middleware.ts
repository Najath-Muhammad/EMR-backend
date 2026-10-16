import { Request, Response, NextFunction } from 'express';
import { TokenExpiredError } from 'jsonwebtoken';
import { verifyAccessToken } from '../utils/token.util';
import { Role } from '../constants/roles';
import { UnauthorizedError, ForbiddenError } from '../errors/AppError';
import { MESSAGES } from '../constants/messages';


export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError(MESSAGES.UNAUTHORIZED);
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    throw new UnauthorizedError(MESSAGES.UNAUTHORIZED);
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      throw new UnauthorizedError(MESSAGES.TOKEN_EXPIRED);
    }
    throw new UnauthorizedError(MESSAGES.TOKEN_INVALID);
  }
}

export function authorize(...allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError(MESSAGES.UNAUTHORIZED);
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError(MESSAGES.FORBIDDEN);
    }

    next();
  };
}
