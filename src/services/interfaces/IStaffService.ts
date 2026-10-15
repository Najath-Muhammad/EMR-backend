import {
  CreateStaffInput,
  UpdateStaffInput,
} from '../../validators/staff.validator';
import { PaginationQueryInput } from '../../validators/pagination.validator';
import { StaffResponseDto, StaffCreationResultDto } from '../../dtos/staff.dto';
import { PaginatedResult } from '../../dtos/pagination.dto';

export interface IStaffService {
  createStaff(input: CreateStaffInput): Promise<StaffCreationResultDto>;
  getStaffById(id: string): Promise<StaffResponseDto>;
  updateStaff(id: string, input: UpdateStaffInput): Promise<StaffResponseDto>;
  toggleStaffStatus(id: string, isActive: boolean): Promise<StaffResponseDto>;
  getStaff(query: PaginationQueryInput): Promise<PaginatedResult<StaffResponseDto>>;
  resendActivation(id: string): Promise<StaffCreationResultDto>;
  activateAccount(token: string, password: string): Promise<void>;
}
