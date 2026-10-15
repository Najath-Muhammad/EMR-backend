import { Request, Response } from 'express';
import { IDoctorController } from '../interfaces/IDoctorController';
import { IStaffRepository } from '../../repositories/interfaces/IStaffRepository';
import { IScheduleRepository } from '../../repositories/interfaces/IScheduleRepository';
import { successResponse } from '../../dtos/ApiResponse';
import { HTTP_STATUS } from '../../constants/httpStatus';
import { MESSAGES } from '../../constants/messages';
import { ROLES } from '../../constants/roles';
import { StaffMapper } from '../../mappers/staff.mapper';
import { NotFoundError } from '../../errors/AppError';
import { PaginationQueryInput } from '../../validators/pagination.validator';

export class DoctorController implements IDoctorController {
  constructor(
    private readonly staffRepo: IStaffRepository,
    private readonly scheduleRepo: IScheduleRepository,
  ) {}

  async list(req: Request, res: Response): Promise<void> {
    const query = req.query as unknown as PaginationQueryInput & {
      department?: string;
      isActive?: boolean;
    };

    const { items, total } = await this.staffRepo.findPaginated(
      {
        role: ROLES.DOCTOR,
        search: query.search,
        department: query.department,
        isActive: query.isActive,
      },
      {
        page: query.page || 1,
        limit: query.limit || 50,
        sortBy: query.sortBy || 'name',
        sortOrder: query.sortOrder || 'asc',
      },
    );

    const doctorsWithSchedule = await Promise.all(
      items.map(async (doc) => {
        const staffDto = StaffMapper.toResponseDto(doc);
        const schedule = await this.scheduleRepo.findByDoctorId(doc._id.toString());

        return {
          ...staffDto,
          hasSchedule: Boolean(schedule),
          isScheduleActive: schedule ? schedule.isActive : false,
          slotDuration: schedule ? schedule.slotDuration : undefined,
          workingDaysCount: schedule
            ? schedule.workingDays.filter((d) => d.isEnabled && d.sessions.length > 0).length
            : 0,
        };
      }),
    );

    const limit = query.limit || 50;
    const totalPages = Math.ceil(total / limit) || 1;

    res.status(HTTP_STATUS.OK).json(
      successResponse(MESSAGES.OPERATION_SUCCESS, doctorsWithSchedule, {
        page: query.page || 1,
        limit,
        total,
        totalPages,
      }),
    );
  }

  async getById(req: Request, res: Response): Promise<void> {
    const doctorId = req.params['id'] as string;
    const doc = await this.staffRepo.findById(doctorId);

    if (!doc || doc.role !== ROLES.DOCTOR) {
      throw new NotFoundError(MESSAGES.SCHEDULE_DOCTOR_NOT_FOUND);
    }

    const staffDto = StaffMapper.toResponseDto(doc);
    const schedule = await this.scheduleRepo.findByDoctorId(doctorId);

    res.status(HTTP_STATUS.OK).json(
      successResponse(MESSAGES.OPERATION_SUCCESS, {
        ...staffDto,
        hasSchedule: Boolean(schedule),
        isScheduleActive: schedule ? schedule.isActive : false,
        slotDuration: schedule ? schedule.slotDuration : undefined,
      }),
    );
  }
}
