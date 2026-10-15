import { FilterQuery, Types } from 'mongoose';
import { UserModel, IUser, UserDocument } from '../../models/User.model';
import { IStaffRepository } from '../interfaces/IStaffRepository';
import { Role, ROLES } from '../../constants/roles';

export class StaffRepository implements IStaffRepository {
  async create(data: Partial<IUser>): Promise<UserDocument> {
    return UserModel.create(data);
  }

  async findById(id: string): Promise<UserDocument | null> {
    return UserModel.findById(id).populate('department', 'name code').exec();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return UserModel.findOne({ email: email.toLowerCase().trim() }).exec();
  }

  async findByActivationTokenHash(tokenHash: string): Promise<UserDocument | null> {
    return UserModel.findOne({ activationTokenHash: tokenHash }).select('+activationTokenHash').exec();
  }

  async findActiveReceptionistByDepartment(departmentId: string): Promise<UserDocument | null> {
    return UserModel.findOne({
      department: new Types.ObjectId(departmentId),
      role: ROLES.RECEPTIONIST,
      isActive: true,
    }).exec();
  }

  async countDoctorsByDepartment(departmentId: string): Promise<number> {
    return UserModel.countDocuments({
      department: new Types.ObjectId(departmentId),
      role: ROLES.DOCTOR,
      isActive: true,
    }).exec();
  }

  async countActiveStaffByDepartment(departmentId: string): Promise<number> {
    return UserModel.countDocuments({
      department: new Types.ObjectId(departmentId),
      isActive: true,
    }).exec();
  }

  async updateById(id: string, update: Partial<IUser>): Promise<UserDocument | null> {
    return UserModel.findByIdAndUpdate(id, update, { new: true })
      .populate('department', 'name code')
      .exec();
  }

  async findPaginated(
    filter: { search?: string; role?: Role; department?: string; isActive?: boolean },
    options: { page: number; limit: number; sortBy: string; sortOrder: 'asc' | 'desc' },
  ): Promise<{ items: UserDocument[]; total: number }> {
    const query: FilterQuery<IUser> = {
      role: { $in: [ROLES.DOCTOR, ROLES.RECEPTIONIST] },
    };

    if (filter.role) {
      query.role = filter.role;
    }

    if (filter.department) {
      query.department = new Types.ObjectId(filter.department);
    }

    if (filter.isActive !== undefined) {
      query.isActive = filter.isActive;
    }

    if (filter.search) {
      const regex = new RegExp(filter.search, 'i');
      query.$or = [{ name: regex }, { email: regex }, { phone: regex }, { specialization: regex }];
    }

    const sortDirection = options.sortOrder === 'asc' ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [options.sortBy]: sortDirection };

    const skip = (options.page - 1) * options.limit;

    const [items, total] = await Promise.all([
      UserModel.find(query)
        .populate('department', 'name code')
        .sort(sort)
        .skip(skip)
        .limit(options.limit)
        .exec(),
      UserModel.countDocuments(query).exec(),
    ]);

    return { items, total };
  }
}
