import { IUser, UserDocument } from '../models/User.model';
import { StaffResponseDto } from '../dtos/staff.dto';

interface PopulatedDepartment {
  _id: { toString(): string };
  name: string;
  code: string;
}

export class StaffMapper {
  static toResponseDto(user: IUser | UserDocument): StaffResponseDto {
    let departmentSummary = null;

    if (user.department) {
      if (typeof user.department === 'object' && 'name' in user.department) {
        const pop = user.department as unknown as PopulatedDepartment;
        departmentSummary = {
          id: pop._id.toString(),
          name: pop.name,
          code: pop.code,
        };
      } else {
        departmentSummary = {
          id: user.department.toString(),
          name: '',
          code: '',
        };
      }
    }

    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      department: departmentSummary,
      phone: user.phone ?? '',
      specialization: user.specialization ?? '',
      isActive: user.isActive,
      isActivated: user.isActivated ?? false,
      createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: user.updatedAt instanceof Date ? user.updatedAt.toISOString() : new Date().toISOString(),
    };
  }
}
