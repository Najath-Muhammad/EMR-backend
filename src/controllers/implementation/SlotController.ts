import { Request, Response } from 'express';
import { ISlotController } from '../interfaces/ISlotController';
import { ISlotService } from '../../services/interfaces/ISlotService';
import { successResponse } from '../../dtos/ApiResponse';
import { HTTP_STATUS } from '../../constants/httpStatus';
import { MESSAGES } from '../../constants/messages';
import { GetSlotsQueryInput, PreviewSlotsInput } from '../../validators/slot.validator';

export class SlotController implements ISlotController {
  constructor(private readonly slotService: ISlotService) {}

  async getSlots(req: Request, res: Response): Promise<void> {
    const { doctorId, date, timezone } = req.query as unknown as GetSlotsQueryInput;
    const data = await this.slotService.getSlots(doctorId, date, timezone);
    res.status(HTTP_STATUS.OK).json(successResponse(MESSAGES.SLOTS_FETCHED, data));
  }

  async previewSlots(req: Request, res: Response): Promise<void> {
    const input = req.body as PreviewSlotsInput;
    const data = await this.slotService.previewSlots(input);
    res.status(HTTP_STATUS.OK).json(successResponse(MESSAGES.SLOTS_PREVIEW_GENERATED, data));
  }
}
