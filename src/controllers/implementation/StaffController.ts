import { Request, Response } from 'express';
import { IStaffController } from '../interfaces/IStaffController';
import { IStaffService } from '../../services/interfaces/IStaffService';
import { successResponse } from '../../dtos/ApiResponse';
import { HTTP_STATUS } from '../../constants/httpStatus';
import { MESSAGES } from '../../constants/messages';
import { PaginationQueryInput } from '../../validators/pagination.validator';

export class StaffController implements IStaffController {
  constructor(private readonly staffService: IStaffService) {}

  async create(req: Request, res: Response): Promise<void> {
    const data = await this.staffService.createStaff(req.body);
    res.status(HTTP_STATUS.CREATED).json(successResponse(MESSAGES.STAFF_CREATED, data));
  }

  async getById(req: Request, res: Response): Promise<void> {
    const data = await this.staffService.getStaffById(req.params['id'] as string);
    res.status(HTTP_STATUS.OK).json(successResponse(MESSAGES.OPERATION_SUCCESS, data));
  }

  async update(req: Request, res: Response): Promise<void> {
    const data = await this.staffService.updateStaff(req.params['id'] as string, req.body);
    res.status(HTTP_STATUS.OK).json(successResponse(MESSAGES.STAFF_UPDATED, data));
  }

  async toggleStatus(req: Request, res: Response): Promise<void> {
    const data = await this.staffService.toggleStaffStatus(
      req.params['id'] as string,
      req.body.isActive,
    );
    res.status(HTTP_STATUS.OK).json(successResponse(MESSAGES.STAFF_STATUS_UPDATED, data));
  }

  async list(req: Request, res: Response): Promise<void> {
    const query = req.query as unknown as PaginationQueryInput;
    const result = await this.staffService.getStaff(query);
    res.status(HTTP_STATUS.OK).json(successResponse(MESSAGES.OPERATION_SUCCESS, result.items, result.meta));
  }

  async resendActivation(req: Request, res: Response): Promise<void> {
    const data = await this.staffService.resendActivation(req.params['id'] as string);
    res.status(HTTP_STATUS.OK).json(successResponse(MESSAGES.ACTIVATION_LINK_RESENT, data));
  }

  async activate(req: Request, res: Response): Promise<void> {
    await this.staffService.activateAccount(req.body.token, req.body.password);
    res.status(HTTP_STATUS.OK).json(successResponse(MESSAGES.ACCOUNT_ACTIVATED, null));
  }
}
