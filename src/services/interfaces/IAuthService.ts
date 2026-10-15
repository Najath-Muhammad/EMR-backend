import { LoginInput } from '../../validators/auth.validator';
import { UserResponseDto } from '../../dtos/auth.dto';

export interface AuthResult {
  accessToken: string;
  rawRefreshToken: string;
  user: UserResponseDto;
}

export interface IAuthService {
  login(input: LoginInput): Promise<AuthResult>;
  refreshToken(rawRefreshToken?: string): Promise<AuthResult>;
  logout(rawRefreshToken?: string): Promise<void>;
  getCurrentUser(userId: string): Promise<UserResponseDto>;
}
