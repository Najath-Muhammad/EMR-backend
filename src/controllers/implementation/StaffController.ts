import { Request, Response, NextFunction } from 'express';
import { IStaffController } from '../interfaces/IStaffController';
import { IStaffService } from '../../services/interfaces/IStaffService';
import { successResponse } from '../../dtos/ApiResponse';
import { HTTP_STATUS } from '../../constants/httpStatus';
import { MESSAGES } from '../../constants/messages';
import {
  createStaffSchema,
  updateStaffSchema,
  toggleStaffStatusSchema,
  activateAccountSchema,
} from '../../validators/staff.validator';
import { paginationSchema } from '../../validators/pagination.validator';

export class StaffController implements IStaffController {
  constructor(private readonly _staffService: IStaffService) {}

  async create(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const validatedBody = createStaffSchema.parse(req.body);
      const data = await this._staffService.createStaff(validatedBody);
      res.status(HTTP_STATUS.CREATED).json(successResponse(MESSAGES.STAFF_CREATED, data));
    } catch (error) {
      if (next) return next(error);
      throw error;
    }
  }

  async getById(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const data = await this._staffService.getStaffById(req.params['id'] as string);
      res.status(HTTP_STATUS.OK).json(successResponse(MESSAGES.OPERATION_SUCCESS, data));
    } catch (error) {
      if (next) return next(error);
      throw error;
    }
  }

  async update(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const validatedBody = updateStaffSchema.parse(req.body);
      const data = await this._staffService.updateStaff(req.params['id'] as string, validatedBody);
      res.status(HTTP_STATUS.OK).json(successResponse(MESSAGES.STAFF_UPDATED, data));
    } catch (error) {
      if (next) return next(error);
      throw error;
    }
  }

  async toggleStatus(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const validatedBody = toggleStaffStatusSchema.parse(req.body);
      const data = await this._staffService.toggleStaffStatus(
        req.params['id'] as string,
        validatedBody.isActive,
      );
      res.status(HTTP_STATUS.OK).json(successResponse(MESSAGES.STAFF_STATUS_UPDATED, data));
    } catch (error) {
      if (next) return next(error);
      throw error;
    }
  }

  async list(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const query = paginationSchema.parse(req.query);
      const result = await this._staffService.getStaff(query);
      res.status(HTTP_STATUS.OK).json(successResponse(MESSAGES.OPERATION_SUCCESS, result.items, result.meta));
    } catch (error) {
      if (next) return next(error);
      throw error;
    }
  }

  async resendActivation(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const data = await this._staffService.resendActivation(req.params['id'] as string);
      res.status(HTTP_STATUS.OK).json(successResponse(MESSAGES.ACTIVATION_LINK_RESENT, data));
    } catch (error) {
      if (next) return next(error);
      throw error;
    }
  }

  async activate(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const validatedBody = activateAccountSchema.parse(req.body);
      await this._staffService.activateAccount(validatedBody.token, validatedBody.password);
      res.status(HTTP_STATUS.OK).json(successResponse(MESSAGES.ACCOUNT_ACTIVATED, null));
    } catch (error) {
      if (next) return next(error);
      throw error;
    }
  }
}
