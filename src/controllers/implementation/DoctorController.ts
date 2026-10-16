import { Request, Response, NextFunction } from 'express';
import { IDoctorController } from '../interfaces/IDoctorController';
import { IStaffRepository } from '../../repositories/interfaces/IStaffRepository';
import { IScheduleRepository } from '../../repositories/interfaces/IScheduleRepository';
import { successResponse } from '../../dtos/ApiResponse';
import { HTTP_STATUS } from '../../constants/httpStatus';
import { MESSAGES } from '../../constants/messages';
import { ROLES } from '../../constants/roles';
import { StaffMapper } from '../../mappers/staff.mapper';
import { NotFoundError } from '../../errors/AppError';
import { paginationSchema } from '../../validators/pagination.validator';

export class DoctorController implements IDoctorController {
  constructor(
    private readonly _staffRepo: IStaffRepository,
    private readonly _scheduleRepo: IScheduleRepository,
  ) {}

  async list(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const parsed = paginationSchema.parse(req.query);
      const query = {
        ...parsed,
        department: req.query['department'] as string | undefined,
        isActive: req.query['isActive'] !== undefined ? req.query['isActive'] === 'true' : undefined,
      };

      const { items, total } = await this._staffRepo.findPaginated(
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
          const schedule = await this._scheduleRepo.findByDoctorId(doc._id.toString());

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
    } catch (error) {
      if (next) return next(error);
      throw error;
    }
  }

  async getById(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const doctorId = req.params['id'] as string;
      const doc = await this._staffRepo.findById(doctorId);

      if (!doc || doc.role !== ROLES.DOCTOR) {
        throw new NotFoundError(MESSAGES.SCHEDULE_DOCTOR_NOT_FOUND);
      }

      const staffDto = StaffMapper.toResponseDto(doc);
      const schedule = await this._scheduleRepo.findByDoctorId(doctorId);

      res.status(HTTP_STATUS.OK).json(
        successResponse(MESSAGES.OPERATION_SUCCESS, {
          ...staffDto,
          hasSchedule: Boolean(schedule),
          isScheduleActive: schedule ? schedule.isActive : false,
          slotDuration: schedule ? schedule.slotDuration : undefined,
        }),
      );
    } catch (error) {
      if (next) return next(error);
      throw error;
    }
  }
}
