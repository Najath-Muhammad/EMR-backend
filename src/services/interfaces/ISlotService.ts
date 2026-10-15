import { DaySlotsResultDto } from '../../dtos/slot.dto';
import { PreviewSlotsInput } from '../../validators/slot.validator';

export interface ISlotService {
  getSlots(doctorId: string, dateStr: string, timezone?: string): Promise<DaySlotsResultDto>;
  previewSlots(input: PreviewSlotsInput): Promise<DaySlotsResultDto>;
}
