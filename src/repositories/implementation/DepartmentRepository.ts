import { FilterQuery } from 'mongoose';
import { DepartmentModel, IDepartment, DepartmentDocument } from '../../models/Department.model';
import { IDepartmentRepository } from '../interfaces/IDepartmentRepository';
import { logger } from '../../utils/logger';

export class DepartmentRepository implements IDepartmentRepository {
  async create(data: Partial<IDepartment>): Promise<DepartmentDocument> {
    try {
      return await DepartmentModel.create(data);
    } catch (error) {
      logger.error('Database error in DepartmentRepository.create:', {
        code: data.code,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async findById(id: string): Promise<DepartmentDocument | null> {
    try {
      return await DepartmentModel.findById(id).exec();
    } catch (error) {
      logger.error('Database error in DepartmentRepository.findById:', {
        id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async findByNameOrCode(name: string, code: string): Promise<DepartmentDocument | null> {
    try {
      return await DepartmentModel.findOne({
        $or: [{ name: { $regex: new RegExp(`^${name}$`, 'i') } }, { code: code.toUpperCase() }],
      }).exec();
    } catch (error) {
      logger.error('Database error in DepartmentRepository.findByNameOrCode:', {
        name,
        code,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async updateById(id: string, update: Partial<IDepartment>): Promise<DepartmentDocument | null> {
    try {
      return await DepartmentModel.findByIdAndUpdate(id, update, { new: true }).exec();
    } catch (error) {
      logger.error('Database error in DepartmentRepository.updateById:', {
        id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async findPaginated(
    filter: { search?: string; isActive?: boolean },
    options: { page: number; limit: number; sortBy: string; sortOrder: 'asc' | 'desc' },
  ): Promise<{ items: DepartmentDocument[]; total: number }> {
    try {
      const query: FilterQuery<IDepartment> = {};

      if (filter.isActive !== undefined) {
        query.isActive = filter.isActive;
      }

      if (filter.search) {
        const regex = new RegExp(filter.search, 'i');
        query.$or = [{ name: regex }, { code: regex }, { description: regex }];
      }

      const sortDirection = options.sortOrder === 'asc' ? 1 : -1;
      const sort: Record<string, 1 | -1> = { [options.sortBy]: sortDirection };

      const skip = (options.page - 1) * options.limit;

      const [items, total] = await Promise.all([
        DepartmentModel.find(query).sort(sort).skip(skip).limit(options.limit).exec(),
        DepartmentModel.countDocuments(query).exec(),
      ]);

      return { items, total };
    } catch (error) {
      logger.error('Database error in DepartmentRepository.findPaginated:', {
        filter,
        options,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async findAllActive(): Promise<DepartmentDocument[]> {
    try {
      return await DepartmentModel.find({ isActive: true }).sort({ name: 1 }).exec();
    } catch (error) {
      logger.error('Database error in DepartmentRepository.findAllActive:', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
