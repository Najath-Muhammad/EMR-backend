import { FilterQuery, Types } from 'mongoose';
import { UserModel, IUser, UserDocument } from '../../models/User.model';
import { IStaffRepository } from '../interfaces/IStaffRepository';
import { Role, ROLES } from '../../constants/roles';
import { logger } from '../../utils/logger';

export class StaffRepository implements IStaffRepository {
  async create(data: Partial<IUser>): Promise<UserDocument> {
    try {
      return await UserModel.create(data);
    } catch (error) {
      logger.error('Database error in StaffRepository.create:', {
        email: data.email,
        role: data.role,
        department: data.department,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async findById(id: string): Promise<UserDocument | null> {
    try {
      return await UserModel.findById(id).populate('department', 'name code').exec();
    } catch (error) {
      logger.error('Database error in StaffRepository.findById:', {
        id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    try {
      return await UserModel.findOne({ email: email.toLowerCase().trim() }).exec();
    } catch (error) {
      logger.error('Database error in StaffRepository.findByEmail:', {
        email,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async findByActivationTokenHash(tokenHash: string): Promise<UserDocument | null> {
    try {
      return await UserModel.findOne({ activationTokenHash: tokenHash }).select('+activationTokenHash').exec();
    } catch (error) {
      logger.error('Database error in StaffRepository.findByActivationTokenHash:', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async findActiveReceptionistByDepartment(departmentId: string): Promise<UserDocument | null> {
    try {
      return await UserModel.findOne({
        department: new Types.ObjectId(departmentId),
        role: ROLES.RECEPTIONIST,
        isActive: true,
      }).exec();
    } catch (error) {
      logger.error('Database error in StaffRepository.findActiveReceptionistByDepartment:', {
        departmentId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async countDoctorsByDepartment(departmentId: string): Promise<number> {
    try {
      return await UserModel.countDocuments({
        department: new Types.ObjectId(departmentId),
        role: ROLES.DOCTOR,
        isActive: true,
      }).exec();
    } catch (error) {
      logger.error('Database error in StaffRepository.countDoctorsByDepartment:', {
        departmentId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async countActiveStaffByDepartment(departmentId: string): Promise<number> {
    try {
      return await UserModel.countDocuments({
        department: new Types.ObjectId(departmentId),
        isActive: true,
      }).exec();
    } catch (error) {
      logger.error('Database error in StaffRepository.countActiveStaffByDepartment:', {
        departmentId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async updateById(id: string, update: Partial<IUser>): Promise<UserDocument | null> {
    try {
      return await UserModel.findByIdAndUpdate(id, update, { new: true })
        .populate('department', 'name code')
        .exec();
    } catch (error) {
      logger.error('Database error in StaffRepository.updateById:', {
        id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async findPaginated(
    filter: { search?: string; role?: Role; department?: string; isActive?: boolean },
    options: { page: number; limit: number; sortBy: string; sortOrder: 'asc' | 'desc' },
  ): Promise<{ items: UserDocument[]; total: number }> {
    try {
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
    } catch (error) {
      logger.error('Database error in StaffRepository.findPaginated:', {
        filter,
        options,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
