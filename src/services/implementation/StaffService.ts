import crypto from 'crypto';
import { Types } from 'mongoose';
import { IStaffService } from '../interfaces/IStaffService';
import { IStaffRepository } from '../../repositories/interfaces/IStaffRepository';
import { IDepartmentRepository } from '../../repositories/interfaces/IDepartmentRepository';
import {
  CreateStaffInput,
  UpdateStaffInput,
} from '../../validators/staff.validator';
import { PaginationQueryInput } from '../../validators/pagination.validator';
import { StaffResponseDto, StaffCreationResultDto } from '../../dtos/staff.dto';
import { PaginatedResult } from '../../dtos/pagination.dto';
import { StaffMapper } from '../../mappers/staff.mapper';
import { hashToken } from '../../utils/token.util';
import { hashPassword } from '../../utils/password.util';
import { ConflictError, NotFoundError, ForbiddenError, BadRequestError } from '../../errors/AppError';
import { MESSAGES } from '../../constants/messages';
import { ROLES, Role } from '../../constants/roles';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { IAuditLogService } from '../interfaces/IAuditLogService';

export class StaffService implements IStaffService {
  constructor(
    private readonly staffRepo: IStaffRepository,
    private readonly departmentRepo: IDepartmentRepository,
    private readonly auditLogService?: IAuditLogService,
  ) {}

  private getClientBaseUrl(): string {
    const origins = env.CORS_ORIGINS.split(',');
    return origins[0]?.trim() || 'http://localhost:5173';
  }

  async createStaff(input: CreateStaffInput): Promise<StaffCreationResultDto> {
    const existingUser = await this.staffRepo.findByEmail(input.email);
    if (existingUser) {
      throw new ConflictError(MESSAGES.STAFF_EMAIL_EXISTS);
    }

    const department = await this.departmentRepo.findById(input.department);
    if (!department) {
      throw new NotFoundError(MESSAGES.DEPARTMENT_INVALID);
    }
    if (!department.isActive) {
      throw new BadRequestError(MESSAGES.DEPARTMENT_INACTIVE_ASSIGNMENT);
    }

    // Atomic invariant: At most one active receptionist per department
    if (input.role === ROLES.RECEPTIONIST) {
      const activeReceptionist = await this.staffRepo.findActiveReceptionistByDepartment(input.department);
      if (activeReceptionist) {
        throw new ConflictError(MESSAGES.RECEPTIONIST_LIMIT_EXCEEDED);
      }
    }

    // Generate single-use, 48-hour activation token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    const created = await this.staffRepo.create({
      name: input.name,
      email: input.email.toLowerCase().trim(),
      role: input.role,
      department: department._id,
      phone: input.phone ?? '',
      specialization: input.specialization ?? '',
      isActive: true,
      isActivated: false,
      activationTokenHash: tokenHash,
      activationTokenExpiresAt: expiresAt,
    });

    const populated = await this.staffRepo.findById(created._id.toString());
    const activationLink = `${this.getClientBaseUrl()}/activate-account?token=${rawToken}`;

    logger.info(`Staff account created for ${created.email} (${created.role}). Activation link generated.`);

    void this.auditLogService?.log({
      action: 'STAFF_CREATE',
      entityType: 'User',
      entityId: created._id.toString(),
      details: {
        email: created.email,
        role: created.role,
        department: department.name,
      },
    });

    return {
      staff: StaffMapper.toResponseDto(populated ?? created),
      activationLink,
    };
  }

  async getStaffById(id: string): Promise<StaffResponseDto> {
    const staff = await this.staffRepo.findById(id);
    if (!staff) {
      throw new NotFoundError(MESSAGES.STAFF_NOT_FOUND);
    }
    return StaffMapper.toResponseDto(staff);
  }

  async updateStaff(id: string, input: UpdateStaffInput): Promise<StaffResponseDto> {
    const staff = await this.staffRepo.findById(id);
    if (!staff) {
      throw new NotFoundError(MESSAGES.STAFF_NOT_FOUND);
    }

    // Super Admin protection guard
    if (staff.role === ROLES.SUPER_ADMIN || staff.email === env.SUPER_ADMIN_EMAIL) {
      throw new ForbiddenError(MESSAGES.SUPER_ADMIN_PROTECTED);
    }

    if (input.department && input.department !== staff.department?._id.toString()) {
      const targetDept = await this.departmentRepo.findById(input.department);
      if (!targetDept) {
        throw new NotFoundError(MESSAGES.DEPARTMENT_INVALID);
      }
      if (!targetDept.isActive) {
        throw new BadRequestError(MESSAGES.DEPARTMENT_INACTIVE_ASSIGNMENT);
      }

      // If moving an active receptionist, verify the target department has no active receptionist
      if (staff.role === ROLES.RECEPTIONIST && staff.isActive) {
        const activeReceptionist = await this.staffRepo.findActiveReceptionistByDepartment(input.department);
        if (activeReceptionist && activeReceptionist._id.toString() !== id) {
          throw new ConflictError(MESSAGES.RECEPTIONIST_LIMIT_EXCEEDED);
        }
      }
    }

    const updated = await this.staffRepo.updateById(id, {
      ...(input.name && { name: input.name }),
      ...(input.department && { department: new Types.ObjectId(input.department) }),
      ...(input.phone !== undefined && { phone: input.phone }),
      ...(input.specialization !== undefined && { specialization: input.specialization }),
    });

    if (!updated) {
      throw new NotFoundError(MESSAGES.STAFF_NOT_FOUND);
    }

    void this.auditLogService?.log({
      action: 'STAFF_UPDATE',
      entityType: 'User',
      entityId: id,
      details: {
        updatedFields: Object.keys(input),
      },
    });

    return StaffMapper.toResponseDto(updated);
  }

  async toggleStaffStatus(id: string, isActive: boolean): Promise<StaffResponseDto> {
    const staff = await this.staffRepo.findById(id);
    if (!staff) {
      throw new NotFoundError(MESSAGES.STAFF_NOT_FOUND);
    }

    // Super Admin protection guard
    if (staff.role === ROLES.SUPER_ADMIN || staff.email === env.SUPER_ADMIN_EMAIL) {
      throw new ForbiddenError(MESSAGES.SUPER_ADMIN_PROTECTED);
    }

    // If activating a receptionist, ensure the department doesn't already have an active receptionist
    if (isActive && staff.role === ROLES.RECEPTIONIST && staff.department) {
      const deptId = staff.department._id ? staff.department._id.toString() : staff.department.toString();
      const existingActive = await this.staffRepo.findActiveReceptionistByDepartment(deptId);
      if (existingActive && existingActive._id.toString() !== id) {
        throw new ConflictError(MESSAGES.RECEPTIONIST_LIMIT_EXCEEDED);
      }
    }

    const updated = await this.staffRepo.updateById(id, { isActive });
    if (!updated) {
      throw new NotFoundError(MESSAGES.STAFF_NOT_FOUND);
    }

    void this.auditLogService?.log({
      action: 'STAFF_STATUS_TOGGLE',
      entityType: 'User',
      entityId: id,
      details: {
        email: staff.email,
        role: staff.role,
        isActive,
      },
    });

    return StaffMapper.toResponseDto(updated);
  }

  async getStaff(query: PaginationQueryInput): Promise<PaginatedResult<StaffResponseDto>> {
    const filter = {
      search: query.search,
      role: query.role as Role | undefined,
      department: query.department,
      isActive: query.isActive === 'all' ? undefined : query.isActive === 'false' ? false : query.isActive === 'true' ? true : undefined,
    };

    const options = {
      page: query.page,
      limit: query.limit,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    };

    const { items, total } = await this.staffRepo.findPaginated(filter, options);

    return {
      items: items.map((u) => StaffMapper.toResponseDto(u)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit) || 1,
      },
    };
  }

  async resendActivation(id: string): Promise<StaffCreationResultDto> {
    const staff = await this.staffRepo.findById(id);
    if (!staff) {
      throw new NotFoundError(MESSAGES.STAFF_NOT_FOUND);
    }

    if (staff.isActivated) {
      throw new BadRequestError('Staff member has already activated their account.');
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const updated = await this.staffRepo.updateById(id, {
      activationTokenHash: tokenHash,
      activationTokenExpiresAt: expiresAt,
    });

    const activationLink = `${this.getClientBaseUrl()}/activate-account?token=${rawToken}`;

    return {
      staff: StaffMapper.toResponseDto(updated ?? staff),
      activationLink,
    };
  }

  async activateAccount(token: string, password: string): Promise<void> {
    const tokenHash = hashToken(token);
    const user = await this.staffRepo.findByActivationTokenHash(tokenHash);

    if (!user) {
      throw new BadRequestError(MESSAGES.ACTIVATION_TOKEN_INVALID);
    }

    if (user.isActivated) {
      throw new BadRequestError('Account is already activated. Please sign in with your credentials.');
    }

    if (user.activationTokenExpiresAt && user.activationTokenExpiresAt < new Date()) {
      throw new BadRequestError(MESSAGES.ACTIVATION_TOKEN_INVALID);
    }

    const hashedPassword = await hashPassword(password);

    await this.staffRepo.updateById(user._id.toString(), {
      password: hashedPassword,
      isActivated: true,
      isActive: true,
      activationTokenHash: '',
      activationTokenExpiresAt: undefined,
    });

    logger.info(`Account successfully activated for ${user.email} (${user.role}).`);
  }
}
