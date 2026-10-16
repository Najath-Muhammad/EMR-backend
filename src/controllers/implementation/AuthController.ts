import { Request, Response, NextFunction } from 'express';
import 'cookie-parser';
import { IAuthController } from '../interfaces/IAuthController';
import { IAuthService } from '../../services/interfaces/IAuthService';
import { successResponse } from '../../dtos/ApiResponse';
import { HTTP_STATUS } from '../../constants/httpStatus';
import { MESSAGES } from '../../constants/messages';
import {
  COOKIE_NAMES,
  REFRESH_COOKIE_OPTIONS,
  CLEAR_REFRESH_COOKIE_OPTIONS,
} from '../../constants/cookies';
import { UnauthorizedError } from '../../errors/AppError';
import { loginSchema } from '../../validators/auth.validator';

export class AuthController implements IAuthController {
  constructor(private readonly _authService: IAuthService) {}

  async login(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const validatedBody = loginSchema.parse(req.body);
      const context = { ip: req.ip, userAgent: req.headers['user-agent'] };
      const result = await this._authService.login(validatedBody, context);

      res.cookie(COOKIE_NAMES.REFRESH_TOKEN, result.rawRefreshToken, REFRESH_COOKIE_OPTIONS);

      res.status(HTTP_STATUS.OK).json(
        successResponse(MESSAGES.LOGIN_SUCCESS, {
          accessToken: result.accessToken,
          user: result.user,
        }),
      );
    } catch (error) {
      if (next) return next(error);
      throw error;
    }
  }

  async refresh(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const cookies = (req.cookies || {}) as Record<string, string | undefined>;
      const rawRefreshToken = cookies[COOKIE_NAMES.REFRESH_TOKEN] || (req.signedCookies as Record<string, string | undefined> | undefined)?.[COOKIE_NAMES.REFRESH_TOKEN];
      const context = { ip: req.ip, userAgent: req.headers['user-agent'] };
      const result = await this._authService.refreshToken(rawRefreshToken, context);

      res.cookie(COOKIE_NAMES.REFRESH_TOKEN, result.rawRefreshToken, REFRESH_COOKIE_OPTIONS);

      res.status(HTTP_STATUS.OK).json(
        successResponse(MESSAGES.TOKEN_REFRESHED, {
          accessToken: result.accessToken,
          user: result.user,
        }),
      );
    } catch (error) {
      if (next) return next(error);
      throw error;
    }
  }

  async logout(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const cookies = (req.cookies || {}) as Record<string, string | undefined>;
      const rawRefreshToken = cookies[COOKIE_NAMES.REFRESH_TOKEN] || (req.signedCookies as Record<string, string | undefined> | undefined)?.[COOKIE_NAMES.REFRESH_TOKEN];
      const context = { ip: req.ip, userAgent: req.headers['user-agent'] };
      await this._authService.logout(rawRefreshToken, context);

      res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, CLEAR_REFRESH_COOKIE_OPTIONS);

      res.status(HTTP_STATUS.OK).json(successResponse(MESSAGES.LOGOUT_SUCCESS, null));
    } catch (error) {
      if (next) return next(error);
      throw error;
    }
  }

  async getMe(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError(MESSAGES.UNAUTHORIZED);
      }

      const user = await this._authService.getCurrentUser(req.user.userId);
      res.status(HTTP_STATUS.OK).json(successResponse(MESSAGES.ME_SUCCESS, { user }));
    } catch (error) {
      if (next) return next(error);
      throw error;
    }
  }
}
