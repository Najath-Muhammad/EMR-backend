import { Request, Response } from 'express';
import { IDepartmentController } from '../interfaces/IDepartmentController';
import { IDepartmentService } from '../../services/interfaces/IDepartmentService';
import { successResponse } from '../../dtos/ApiResponse';
import { HTTP_STATUS } from '../../constants/httpStatus';
import { MESSAGES } from '../../constants/messages';
import { PaginationQueryInput } from '../../validators/pagination.validator';

export class DepartmentController implements IDepartmentController {
  constructor(private readonly departmentService: IDepartmentService) {}

  async create(req: Request, res: Response): Promise<void> {
    const data = await this.departmentService.createDepartment(req.body);
    res.status(HTTP_STATUS.CREATED).json(successResponse(MESSAGES.DEPARTMENT_CREATED, data));
  }

  async getById(req: Request, res: Response): Promise<void> {
    const data = await this.departmentService.getDepartmentById(req.params['id'] as string);
    res.status(HTTP_STATUS.OK).json(successResponse(MESSAGES.OPERATION_SUCCESS, data));
  }

  async update(req: Request, res: Response): Promise<void> {
    const data = await this.departmentService.updateDepartment(req.params['id'] as string, req.body);
    res.status(HTTP_STATUS.OK).json(successResponse(MESSAGES.DEPARTMENT_UPDATED, data));
  }

  async toggleStatus(req: Request, res: Response): Promise<void> {
    const data = await this.departmentService.toggleDepartmentStatus(
      req.params['id'] as string,
      req.body.isActive,
    );
    res.status(HTTP_STATUS.OK).json(successResponse(MESSAGES.DEPARTMENT_STATUS_UPDATED, data));
  }

  async list(req: Request, res: Response): Promise<void> {
    const query = req.query as unknown as PaginationQueryInput;
    const result = await this.departmentService.getDepartments(query);
    res.status(HTTP_STATUS.OK).json(successResponse(MESSAGES.OPERATION_SUCCESS, result.items, result.meta));
  }

  async listActive(_req: Request, res: Response): Promise<void> {
    const items = await this.departmentService.getAllActiveDepartments();
    res.status(HTTP_STATUS.OK).json(successResponse(MESSAGES.OPERATION_SUCCESS, items));
  }
}
