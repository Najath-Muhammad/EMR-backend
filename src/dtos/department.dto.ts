export interface CreateDepartmentDto {
  name: string;
  code: string;
  description?: string;
}

export interface UpdateDepartmentDto {
  name?: string;
  description?: string;
}

export interface DepartmentResponseDto {
  id: string;
  name: string;
  code: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  doctorsCount?: number;
  activeReceptionist?: {
    id: string;
    name: string;
    email: string;
  } | null;
}
