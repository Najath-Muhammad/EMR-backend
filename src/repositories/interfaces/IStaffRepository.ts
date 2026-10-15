import { IUser, UserDocument } from '../../models/User.model';
import { Role } from '../../constants/roles';

export interface IStaffRepository {
  create(data: Partial<IUser>): Promise<UserDocument>;
  findById(id: string): Promise<UserDocument | null>;
  findByEmail(email: string): Promise<UserDocument | null>;
  findByActivationTokenHash(tokenHash: string): Promise<UserDocument | null>;
  findActiveReceptionistByDepartment(departmentId: string): Promise<UserDocument | null>;
  countDoctorsByDepartment(departmentId: string): Promise<number>;
  countActiveStaffByDepartment(departmentId: string): Promise<number>;
  updateById(id: string, update: Partial<IUser>): Promise<UserDocument | null>;
  findPaginated(
    filter: { search?: string; role?: Role; department?: string; isActive?: boolean },
    options: { page: number; limit: number; sortBy: string; sortOrder: 'asc' | 'desc' },
  ): Promise<{ items: UserDocument[]; total: number }>;
}
