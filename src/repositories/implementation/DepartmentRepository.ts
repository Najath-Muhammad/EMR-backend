import { FilterQuery } from 'mongoose';
import { DepartmentModel, IDepartment, DepartmentDocument } from '../../models/Department.model';
import { IDepartmentRepository } from '../interfaces/IDepartmentRepository';

export class DepartmentRepository implements IDepartmentRepository {
  async create(data: Partial<IDepartment>): Promise<DepartmentDocument> {
    return DepartmentModel.create(data);
  }

  async findById(id: string): Promise<DepartmentDocument | null> {
    return DepartmentModel.findById(id).exec();
  }

  async findByNameOrCode(name: string, code: string): Promise<DepartmentDocument | null> {
    return DepartmentModel.findOne({
      $or: [{ name: { $regex: new RegExp(`^${name}$`, 'i') } }, { code: code.toUpperCase() }],
    }).exec();
  }

  async updateById(id: string, update: Partial<IDepartment>): Promise<DepartmentDocument | null> {
    return DepartmentModel.findByIdAndUpdate(id, update, { new: true }).exec();
  }

  async findPaginated(
    filter: { search?: string; isActive?: boolean },
    options: { page: number; limit: number; sortBy: string; sortOrder: 'asc' | 'desc' },
  ): Promise<{ items: DepartmentDocument[]; total: number }> {
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
  }

  async findAllActive(): Promise<DepartmentDocument[]> {
    return DepartmentModel.find({ isActive: true }).sort({ name: 1 }).exec();
  }
}
