import { IDepartment, DepartmentDocument } from '../../models/Department.model';

export interface IDepartmentRepository {
  create(data: Partial<IDepartment>): Promise<DepartmentDocument>;
  findById(id: string): Promise<DepartmentDocument | null>;
  findByNameOrCode(name: string, code: string): Promise<DepartmentDocument | null>;
  updateById(id: string, update: Partial<IDepartment>): Promise<DepartmentDocument | null>;
  findPaginated(
    filter: { search?: string; isActive?: boolean },
    options: { page: number; limit: number; sortBy: string; sortOrder: 'asc' | 'desc' },
  ): Promise<{ items: DepartmentDocument[]; total: number }>;
  findAllActive(): Promise<DepartmentDocument[]>;
}
