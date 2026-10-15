import { LoginInput } from '../../validators/auth.validator';
import { UserResponseDto } from '../../dtos/auth.dto';

export interface AuthResult {
  accessToken: string;
  rawRefreshToken: string;
  user: UserResponseDto;
}

export interface RequestContext {
  ip?: string;
  userAgent?: string;
}

export interface IAuthService {
  login(input: LoginInput, context?: RequestContext): Promise<AuthResult>;
  refreshToken(rawRefreshToken?: string, context?: RequestContext): Promise<AuthResult>;
  logout(rawRefreshToken?: string, context?: RequestContext): Promise<void>;
  getCurrentUser(userId: string): Promise<UserResponseDto>;
}

