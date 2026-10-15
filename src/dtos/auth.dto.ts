import { Role } from '../constants/roles';

export interface UserResponseDto {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface AuthResponseData {
  accessToken: string;
  user: UserResponseDto;
}

export interface LoginRequestDto {
  email: string;
  password: string;
}
