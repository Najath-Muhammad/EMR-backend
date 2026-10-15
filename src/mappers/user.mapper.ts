import { IUser, UserDocument } from '../models/User.model';
import { UserResponseDto } from '../dtos/auth.dto';

export class UserMapper {
  static toResponseDto(user: IUser | UserDocument): UserResponseDto {
    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department ? user.department.toString() : null,
      isActive: user.isActive,
      createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : new Date().toISOString(),
    };
  }
}
