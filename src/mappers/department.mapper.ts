import { IDepartment, DepartmentDocument } from '../models/Department.model';
import { DepartmentResponseDto } from '../dtos/department.dto';

export class DepartmentMapper {
  static toResponseDto(
    department: IDepartment | DepartmentDocument,
    extra?: {
      doctorsCount?: number;
      activeReceptionist?: { id: string; name: string; email: string } | null;
    },
  ): DepartmentResponseDto {
    return {
      id: department._id.toString(),
      name: department.name,
      code: department.code,
      description: department.description ?? '',
      isActive: department.isActive,
      createdAt:
        department.createdAt instanceof Date ? department.createdAt.toISOString() : new Date().toISOString(),
      updatedAt:
        department.updatedAt instanceof Date ? department.updatedAt.toISOString() : new Date().toISOString(),
      doctorsCount: extra?.doctorsCount,
      activeReceptionist: extra?.activeReceptionist,
    };
  }
}
