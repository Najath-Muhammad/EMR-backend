import { CreateDepartmentInput, UpdateDepartmentInput } from '../../validators/department.validator';
import { PaginationQueryInput } from '../../validators/pagination.validator';
import { DepartmentResponseDto } from '../../dtos/department.dto';
import { PaginatedResult } from '../../dtos/pagination.dto';

export interface IDepartmentService {
  createDepartment(input: CreateDepartmentInput): Promise<DepartmentResponseDto>;
  getDepartmentById(id: string): Promise<DepartmentResponseDto>;
  updateDepartment(id: string, input: UpdateDepartmentInput): Promise<DepartmentResponseDto>;
  toggleDepartmentStatus(id: string, isActive: boolean): Promise<DepartmentResponseDto>;
  getDepartments(query: PaginationQueryInput): Promise<PaginatedResult<DepartmentResponseDto>>;
  getAllActiveDepartments(): Promise<DepartmentResponseDto[]>;
}
