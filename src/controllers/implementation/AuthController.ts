import { Request, Response } from 'express';
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

export class AuthController implements IAuthController {
  constructor(private readonly authService: IAuthService) {}

  async login(req: Request, res: Response): Promise<void> {
    const result = await this.authService.login(req.body);

    res.cookie(COOKIE_NAMES.REFRESH_TOKEN, result.rawRefreshToken, REFRESH_COOKIE_OPTIONS);

    res.status(HTTP_STATUS.OK).json(
      successResponse(MESSAGES.LOGIN_SUCCESS, {
        accessToken: result.accessToken,
        user: result.user,
      }),
    );
  }

  async refresh(req: Request, res: Response): Promise<void> {
    const rawRefreshToken = req.cookies?.[COOKIE_NAMES.REFRESH_TOKEN] as string | undefined;
    const result = await this.authService.refreshToken(rawRefreshToken);

    res.cookie(COOKIE_NAMES.REFRESH_TOKEN, result.rawRefreshToken, REFRESH_COOKIE_OPTIONS);

    res.status(HTTP_STATUS.OK).json(
      successResponse(MESSAGES.TOKEN_REFRESHED, {
        accessToken: result.accessToken,
        user: result.user,
      }),
    );
  }

  async logout(req: Request, res: Response): Promise<void> {
    const rawRefreshToken = req.cookies?.[COOKIE_NAMES.REFRESH_TOKEN] as string | undefined;
    await this.authService.logout(rawRefreshToken);

    res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, CLEAR_REFRESH_COOKIE_OPTIONS);

    res.status(HTTP_STATUS.OK).json(successResponse(MESSAGES.LOGOUT_SUCCESS, null));
  }

  async getMe(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new UnauthorizedError(MESSAGES.UNAUTHORIZED);
    }

    const user = await this.authService.getCurrentUser(req.user.userId);
    res.status(HTTP_STATUS.OK).json(successResponse(MESSAGES.ME_SUCCESS, { user }));
  }
}
