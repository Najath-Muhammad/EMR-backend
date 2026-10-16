import crypto from 'crypto';
import { IAuthService, AuthResult, RequestContext } from '../interfaces/IAuthService';
import { IUserRepository } from '../../repositories/interfaces/IUserRepository';
import { IRefreshTokenRepository } from '../../repositories/interfaces/IRefreshTokenRepository';
import { IAuditLogService } from '../interfaces/IAuditLogService';
import { LoginInput } from '../../validators/auth.validator';
import { UserResponseDto } from '../../dtos/auth.dto';
import { UserMapper } from '../../mappers/user.mapper';
import { comparePassword } from '../../utils/password.util';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  hashToken,
  calculateRefreshTokenExpiry,
} from '../../utils/token.util';
import { UnauthorizedError, NotFoundError } from '../../errors/AppError';
import { MESSAGES } from '../../constants/messages';

export class AuthService implements IAuthService {
  constructor(
    private readonly _userRepo: IUserRepository,
    private readonly _refreshTokenRepo: IRefreshTokenRepository,
    private readonly _auditLogService?: IAuditLogService,
  ) {}

  async login(input: LoginInput, context?: RequestContext): Promise<AuthResult> {
    try {
      const user = await this._userRepo.findByEmail(input.email, true);
      if (!user) {
        void this._auditLogService?.log({
          action: 'AUTH_LOGIN_FAILURE',
          entityType: 'Auth',
          actor: { email: input.email },
          details: { reason: 'User not found' },
          status: 'FAILURE',
          ipAddress: context?.ip,
          userAgent: context?.userAgent,
        });
        throw new UnauthorizedError(MESSAGES.INVALID_CREDENTIALS);
      }

      if (!user.isActive) {
        void this._auditLogService?.log({
          action: 'AUTH_LOGIN_FAILURE',
          entityType: 'Auth',
          actor: { userId: user._id.toString(), email: user.email, name: user.name, role: user.role },
          details: { reason: 'User inactive' },
          status: 'FAILURE',
          ipAddress: context?.ip,
          userAgent: context?.userAgent,
        });
        throw new UnauthorizedError(MESSAGES.USER_INACTIVE);
      }

      if (!user.password) {
        void this._auditLogService?.log({
          action: 'AUTH_LOGIN_FAILURE',
          entityType: 'Auth',
          actor: { userId: user._id.toString(), email: user.email, name: user.name, role: user.role },
          details: { reason: 'Password not set' },
          status: 'FAILURE',
          ipAddress: context?.ip,
          userAgent: context?.userAgent,
        });
        throw new UnauthorizedError(MESSAGES.INVALID_CREDENTIALS);
      }

      const isPasswordValid = await comparePassword(input.password, user.password);
      if (!isPasswordValid) {
        void this._auditLogService?.log({
          action: 'AUTH_LOGIN_FAILURE',
          entityType: 'Auth',
          actor: { userId: user._id.toString(), email: user.email, name: user.name, role: user.role },
          details: { reason: 'Invalid credentials' },
          status: 'FAILURE',
          ipAddress: context?.ip,
          userAgent: context?.userAgent,
        });
        throw new UnauthorizedError(MESSAGES.INVALID_CREDENTIALS);
      }

      const family = crypto.randomUUID();
      const accessToken = generateAccessToken({
        userId: user._id.toString(),
        role: user.role,
      });
      const { token: rawRefreshToken } = generateRefreshToken(user._id.toString(), family);
      const tokenHash = hashToken(rawRefreshToken);

      await this._refreshTokenRepo.create({
        userId: user._id,
        tokenHash,
        family,
        expiresAt: calculateRefreshTokenExpiry(),
      });

      void this._auditLogService?.log({
        action: 'AUTH_LOGIN_SUCCESS',
        entityType: 'Auth',
        entityId: user._id.toString(),
        actor: { userId: user._id.toString(), email: user.email, name: user.name, role: user.role },
        details: { role: user.role },
        status: 'SUCCESS',
        ipAddress: context?.ip,
        userAgent: context?.userAgent,
      });

      return {
        accessToken,
        rawRefreshToken,
        user: UserMapper.toResponseDto(user),
      };
    } catch (error) {
      throw error;
    }
  }

  async refreshToken(rawRefreshToken?: string, context?: RequestContext): Promise<AuthResult> {
    try {
      if (!rawRefreshToken) {
        throw new UnauthorizedError(MESSAGES.REFRESH_TOKEN_REQUIRED);
      }

      let payload;
      try {
        payload = verifyRefreshToken(rawRefreshToken);
      } catch {
        throw new UnauthorizedError(MESSAGES.REFRESH_TOKEN_INVALID);
      }

      const tokenHash = hashToken(rawRefreshToken);
      const storedToken = await this._refreshTokenRepo.findByHash(tokenHash);

      if (!storedToken) {
        throw new UnauthorizedError(MESSAGES.REFRESH_TOKEN_INVALID);
      }

      if (storedToken.isRevoked) {
        await this._refreshTokenRepo.revokeFamily(storedToken.family);
        void this._auditLogService?.log({
          action: 'AUTH_TOKEN_REFRESH',
          entityType: 'Auth',
          details: { securityWarning: 'Token reuse detected, family revoked' },
          status: 'FAILURE',
          ipAddress: context?.ip,
          userAgent: context?.userAgent,
        });
        throw new UnauthorizedError(MESSAGES.REFRESH_TOKEN_REUSE);
      }

      if (new Date() > storedToken.expiresAt) {
        throw new UnauthorizedError(MESSAGES.REFRESH_TOKEN_INVALID);
      }

      const user = await this._userRepo.findById(payload.userId);
      if (!user || !user.isActive) {
        throw new UnauthorizedError(MESSAGES.UNAUTHORIZED);
      }

      await this._refreshTokenRepo.revokeById(storedToken._id);

      const { token: newRawRefreshToken } = generateRefreshToken(user._id.toString(), storedToken.family);
      const newTokenHash = hashToken(newRawRefreshToken);

      await this._refreshTokenRepo.create({
        userId: user._id,
        tokenHash: newTokenHash,
        family: storedToken.family,
        expiresAt: calculateRefreshTokenExpiry(),
      });

      const newAccessToken = generateAccessToken({
        userId: user._id.toString(),
        role: user.role,
      });

      return {
        accessToken: newAccessToken,
        rawRefreshToken: newRawRefreshToken,
        user: UserMapper.toResponseDto(user),
      };
    } catch (error) {
      throw error;
    }
  }

  async logout(rawRefreshToken?: string, context?: RequestContext): Promise<void> {
    try {
      if (rawRefreshToken) {
        const tokenHash = hashToken(rawRefreshToken);
        await this._refreshTokenRepo.revokeByHash(tokenHash);
      }
      void this._auditLogService?.log({
        action: 'AUTH_LOGOUT',
        entityType: 'Auth',
        status: 'SUCCESS',
        ipAddress: context?.ip,
        userAgent: context?.userAgent,
      });
    } catch (error) {
      throw error;
    }
  }

  async getCurrentUser(userId: string): Promise<UserResponseDto> {
    try {
      const user = await this._userRepo.findById(userId);
      if (!user || !user.isActive) {
        throw new NotFoundError('User');
      }
      return UserMapper.toResponseDto(user);
    } catch (error) {
      throw error;
    }
  }
}
