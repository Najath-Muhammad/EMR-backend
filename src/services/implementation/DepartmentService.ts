import { IDepartmentService } from '../interfaces/IDepartmentService';
import { IDepartmentRepository } from '../../repositories/interfaces/IDepartmentRepository';
import { IStaffRepository } from '../../repositories/interfaces/IStaffRepository';
import { CreateDepartmentInput, UpdateDepartmentInput } from '../../validators/department.validator';
import { PaginationQueryInput } from '../../validators/pagination.validator';
import { DepartmentResponseDto } from '../../dtos/department.dto';
import { PaginatedResult } from '../../dtos/pagination.dto';
import { DepartmentMapper } from '../../mappers/department.mapper';
import { ConflictError, NotFoundError } from '../../errors/AppError';
import { MESSAGES } from '../../constants/messages';

export class DepartmentService implements IDepartmentService {
  constructor(
    private readonly _departmentRepo: IDepartmentRepository,
    private readonly _staffRepo: IStaffRepository,
  ) {}

  async createDepartment(input: CreateDepartmentInput): Promise<DepartmentResponseDto> {
    try {
      const existing = await this._departmentRepo.findByNameOrCode(input.name, input.code);
      if (existing) {
        throw new ConflictError(MESSAGES.DEPARTMENT_EXISTS);
      }

      const created = await this._departmentRepo.create({
        name: input.name,
        code: input.code.toUpperCase(),
        description: input.description,
        isActive: true,
      });

      return DepartmentMapper.toResponseDto(created, { doctorsCount: 0, activeReceptionist: null });
    } catch (error) {
      throw error;
    }
  }

  async getDepartmentById(id: string): Promise<DepartmentResponseDto> {
    try {
      const department = await this._departmentRepo.findById(id);
      if (!department) {
        throw new NotFoundError(MESSAGES.DEPARTMENT_NOT_FOUND);
      }

      const [doctorsCount, activeReceptionist] = await Promise.all([
        this._staffRepo.countDoctorsByDepartment(id),
        this._staffRepo.findActiveReceptionistByDepartment(id),
      ]);

      const receptionistSummary = activeReceptionist
        ? {
            id: activeReceptionist._id.toString(),
            name: activeReceptionist.name,
            email: activeReceptionist.email,
          }
        : null;

      return DepartmentMapper.toResponseDto(department, {
        doctorsCount,
        activeReceptionist: receptionistSummary,
      });
    } catch (error) {
      throw error;
    }
  }

  async updateDepartment(id: string, input: UpdateDepartmentInput): Promise<DepartmentResponseDto> {
    try {
      const department = await this._departmentRepo.findById(id);
      if (!department) {
        throw new NotFoundError(MESSAGES.DEPARTMENT_NOT_FOUND);
      }

      if (input.name && input.name.toLowerCase() !== department.name.toLowerCase()) {
        const existing = await this._departmentRepo.findByNameOrCode(input.name, department.code);
        if (existing && existing._id.toString() !== id) {
          throw new ConflictError('A department with this name already exists');
        }
      }

      const updated = await this._departmentRepo.updateById(id, {
        ...(input.name && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
      });

      if (!updated) {
        throw new NotFoundError(MESSAGES.DEPARTMENT_NOT_FOUND);
      }

      return this.getDepartmentById(id);
    } catch (error) {
      throw error;
    }
  }

  async toggleDepartmentStatus(id: string, isActive: boolean): Promise<DepartmentResponseDto> {
    try {
      const department = await this._departmentRepo.findById(id);
      if (!department) {
        throw new NotFoundError(MESSAGES.DEPARTMENT_NOT_FOUND);
      }

      if (!isActive) {
        const activeStaffCount = await this._staffRepo.countActiveStaffByDepartment(id);
        if (activeStaffCount > 0) {
          throw new ConflictError(
            'Cannot deactivate department with active staff. Please reassign or deactivate staff members first.',
          );
        }
      }

      const updated = await this._departmentRepo.updateById(id, { isActive });
      if (!updated) {
        throw new NotFoundError(MESSAGES.DEPARTMENT_NOT_FOUND);
      }

      return this.getDepartmentById(id);
    } catch (error) {
      throw error;
    }
  }

  async getDepartments(query: PaginationQueryInput): Promise<PaginatedResult<DepartmentResponseDto>> {
    try {
      const filter = {
        search: query.search,
        isActive: query.isActive === 'all' ? undefined : query.isActive === 'false' ? false : query.isActive === 'true' ? true : undefined,
      };

      const options = {
        page: query.page,
        limit: query.limit,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      };

      const { items, total } = await this._departmentRepo.findPaginated(filter, options);

      const mappedItems = await Promise.all(
        items.map(async (dept) => {
          const [doctorsCount, activeReceptionist] = await Promise.all([
            this._staffRepo.countDoctorsByDepartment(dept._id.toString()),
            this._staffRepo.findActiveReceptionistByDepartment(dept._id.toString()),
          ]);

          return DepartmentMapper.toResponseDto(dept, {
            doctorsCount,
            activeReceptionist: activeReceptionist
              ? {
                  id: activeReceptionist._id.toString(),
                  name: activeReceptionist.name,
                  email: activeReceptionist.email,
                }
              : null,
          });
        }),
      );

      return {
        items: mappedItems,
        meta: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit) || 1,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  async getAllActiveDepartments(): Promise<DepartmentResponseDto[]> {
    try {
      const departments = await this._departmentRepo.findAllActive();
      return departments.map((d) => DepartmentMapper.toResponseDto(d));
    } catch (error) {
      throw error;
    }
  }
}
