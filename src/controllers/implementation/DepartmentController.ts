import { Request, Response, NextFunction } from 'express';
import { IDepartmentController } from '../interfaces/IDepartmentController';
import { IDepartmentService } from '../../services/interfaces/IDepartmentService';
import { successResponse } from '../../dtos/ApiResponse';
import { HTTP_STATUS } from '../../constants/httpStatus';
import { MESSAGES } from '../../constants/messages';
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  toggleDepartmentStatusSchema,
} from '../../validators/department.validator';
import { paginationSchema } from '../../validators/pagination.validator';

export class DepartmentController implements IDepartmentController {
  constructor(private readonly _departmentService: IDepartmentService) {}

  async create(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const validatedBody = createDepartmentSchema.parse(req.body);
      const data = await this._departmentService.createDepartment(validatedBody);
      res.status(HTTP_STATUS.CREATED).json(successResponse(MESSAGES.DEPARTMENT_CREATED, data));
    } catch (error) {
      if (next) return next(error);
      throw error;
    }
  }

  async getById(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const data = await this._departmentService.getDepartmentById(req.params['id'] as string);
      res.status(HTTP_STATUS.OK).json(successResponse(MESSAGES.OPERATION_SUCCESS, data));
    } catch (error) {
      if (next) return next(error);
      throw error;
    }
  }

  async update(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const validatedBody = updateDepartmentSchema.parse(req.body);
      const data = await this._departmentService.updateDepartment(req.params['id'] as string, validatedBody);
      res.status(HTTP_STATUS.OK).json(successResponse(MESSAGES.DEPARTMENT_UPDATED, data));
    } catch (error) {
      if (next) return next(error);
      throw error;
    }
  }

  async toggleStatus(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const validatedBody = toggleDepartmentStatusSchema.parse(req.body);
      const data = await this._departmentService.toggleDepartmentStatus(
        req.params['id'] as string,
        validatedBody.isActive,
      );
      res.status(HTTP_STATUS.OK).json(successResponse(MESSAGES.DEPARTMENT_STATUS_UPDATED, data));
    } catch (error) {
      if (next) return next(error);
      throw error;
    }
  }

  async list(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const query = paginationSchema.parse(req.query);
      const result = await this._departmentService.getDepartments(query);
      res.status(HTTP_STATUS.OK).json(successResponse(MESSAGES.OPERATION_SUCCESS, result.items, result.meta));
    } catch (error) {
      if (next) return next(error);
      throw error;
    }
  }

  async listActive(_req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const items = await this._departmentService.getAllActiveDepartments();
      res.status(HTTP_STATUS.OK).json(successResponse(MESSAGES.OPERATION_SUCCESS, items));
    } catch (error) {
      if (next) return next(error);
      throw error;
    }
  }
}
