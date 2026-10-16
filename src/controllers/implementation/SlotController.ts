import { Request, Response, NextFunction } from 'express';
import { ISlotController } from '../interfaces/ISlotController';
import { ISlotService } from '../../services/interfaces/ISlotService';
import { successResponse } from '../../dtos/ApiResponse';
import { HTTP_STATUS } from '../../constants/httpStatus';
import { MESSAGES } from '../../constants/messages';
import { getSlotsQuerySchema, previewSlotsSchema } from '../../validators/slot.validator';

export class SlotController implements ISlotController {
  constructor(private readonly _slotService: ISlotService) {}

  async getSlots(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const validatedQuery = getSlotsQuerySchema.parse(req.query);
      const data = await this._slotService.getSlots(validatedQuery.doctorId, validatedQuery.date, validatedQuery.timezone);
      res.status(HTTP_STATUS.OK).json(successResponse(MESSAGES.SLOTS_FETCHED, data));
    } catch (error) {
      if (next) return next(error);
      throw error;
    }
  }

  async previewSlots(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const validatedBody = previewSlotsSchema.parse(req.body);
      const data = await this._slotService.previewSlots(validatedBody);
      res.status(HTTP_STATUS.OK).json(successResponse(MESSAGES.SLOTS_PREVIEW_GENERATED, data));
    } catch (error) {
      if (next) return next(error);
      throw error;
    }
  }
}
