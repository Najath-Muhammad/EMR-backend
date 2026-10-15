import crypto from 'crypto';
import { IAuthService, AuthResult } from '../interfaces/IAuthService';
import { IUserRepository } from '../../repositories/interfaces/IUserRepository';
import { IRefreshTokenRepository } from '../../repositories/interfaces/IRefreshTokenRepository';
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
    private readonly userRepo: IUserRepository,
    private readonly refreshTokenRepo: IRefreshTokenRepository,
  ) {}

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.userRepo.findByEmail(input.email, true);
    if (!user) {
      throw new UnauthorizedError(MESSAGES.INVALID_CREDENTIALS);
    }

    if (!user.isActive) {
      throw new UnauthorizedError(MESSAGES.USER_INACTIVE);
    }

    if (!user.password) {
      throw new UnauthorizedError(MESSAGES.INVALID_CREDENTIALS);
    }

    const isPasswordValid = await comparePassword(input.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedError(MESSAGES.INVALID_CREDENTIALS);
    }

    const family = crypto.randomUUID();
    const accessToken = generateAccessToken({
      userId: user._id.toString(),
      role: user.role,
    });
    const { token: rawRefreshToken } = generateRefreshToken(user._id.toString(), family);
    const tokenHash = hashToken(rawRefreshToken);

    await this.refreshTokenRepo.create({
      userId: user._id,
      tokenHash,
      family,
      expiresAt: calculateRefreshTokenExpiry(),
    });

    return {
      accessToken,
      rawRefreshToken,
      user: UserMapper.toResponseDto(user),
    };
  }

  async refreshToken(rawRefreshToken?: string): Promise<AuthResult> {
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
    const storedToken = await this.refreshTokenRepo.findByHash(tokenHash);

    if (!storedToken) {
      throw new UnauthorizedError(MESSAGES.REFRESH_TOKEN_INVALID);
    }

    // Reuse detection: If a revoked token is used, someone is attempting to replay a token!
    if (storedToken.isRevoked) {
      await this.refreshTokenRepo.revokeFamily(storedToken.family);
      throw new UnauthorizedError(MESSAGES.REFRESH_TOKEN_REUSE);
    }

    if (new Date() > storedToken.expiresAt) {
      throw new UnauthorizedError(MESSAGES.REFRESH_TOKEN_INVALID);
    }

    const user = await this.userRepo.findById(payload.userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedError(MESSAGES.UNAUTHORIZED);
    }

    // Revoke the old token
    await this.refreshTokenRepo.revokeById(storedToken._id);

    // Issue rotated token within the same family
    const { token: newRawRefreshToken } = generateRefreshToken(user._id.toString(), storedToken.family);
    const newTokenHash = hashToken(newRawRefreshToken);

    await this.refreshTokenRepo.create({
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
  }

  async logout(rawRefreshToken?: string): Promise<void> {
    if (rawRefreshToken) {
      const tokenHash = hashToken(rawRefreshToken);
      await this.refreshTokenRepo.revokeByHash(tokenHash);
    }
  }

  async getCurrentUser(userId: string): Promise<UserResponseDto> {
    const user = await this.userRepo.findById(userId);
    if (!user || !user.isActive) {
      throw new NotFoundError('User');
    }
    return UserMapper.toResponseDto(user);
  }
}
