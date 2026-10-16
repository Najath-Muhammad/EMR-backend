import { Request, Response, NextFunction } from 'express';

export interface ISlotController {
  getSlots(req: Request, res: Response, next?: NextFunction): Promise<void>;
  previewSlots(req: Request, res: Response, next?: NextFunction): Promise<void>;
}
