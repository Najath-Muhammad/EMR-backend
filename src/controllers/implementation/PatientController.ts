import { Request, Response, NextFunction } from 'express';
import { IPatientController } from '../interfaces/IPatientController';
import { IPatientService } from '../../services/interfaces/IPatientService';
import {
  createPatientSchema,
  updatePatientSchema,
  checkDuplicatesSchema,
  searchPatientsQuerySchema,
} from '../../validators/patient.validator';
import { successResponse } from '../../dtos/ApiResponse';
import { HTTP_STATUS } from '../../constants/httpStatus';
import { MESSAGES } from '../../constants/messages';
import { UnauthorizedError } from '../../errors/AppError';

export class PatientController implements IPatientController {
  constructor(private readonly _patientService: IPatientService) {}

  async checkDuplicates(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const input = checkDuplicatesSchema.parse(req.body);
      const result = await this._patientService.checkPotentialDuplicates(input);
      res.status(HTTP_STATUS.OK).json(
        successResponse(
          result.hasMatches ? MESSAGES.PATIENT_DUPLICATE_FOUND : MESSAGES.OPERATION_SUCCESS,
          result,
        ),
      );
    } catch (error) {
      if (next) return next(error);
      throw error;
    }
  }

  async createPatient(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      if (!req.user?.userId) {
        throw new UnauthorizedError(MESSAGES.UNAUTHORIZED);
      }

      const input = createPatientSchema.parse(req.body);
      const data = await this._patientService.createPatient(input, req.user.userId);
      res.status(HTTP_STATUS.CREATED).json(successResponse(MESSAGES.PATIENT_CREATED, data));
    } catch (error) {
      if (next) return next(error);
      throw error;
    }
  }

  async getPatients(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const query = searchPatientsQuerySchema.parse(req.query);
      const result = await this._patientService.getPatients(query);

      res.status(HTTP_STATUS.OK).json(
        successResponse(MESSAGES.PATIENTS_FETCHED, result.items, {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
        }),
      );
    } catch (error) {
      if (next) return next(error);
      throw error;
    }
  }

  async getPatientById(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const id = req.params['id'] as string;
      const data = await this._patientService.getPatientById(id);
      res.status(HTTP_STATUS.OK).json(successResponse(MESSAGES.PATIENT_FETCHED, data));
    } catch (error) {
      if (next) return next(error);
      throw error;
    }
  }

  async updatePatient(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const id = req.params['id'] as string;
      const input = updatePatientSchema.parse(req.body);
      const data = await this._patientService.updatePatient(id, input);
      res.status(HTTP_STATUS.OK).json(successResponse(MESSAGES.PATIENT_UPDATED, data));
    } catch (error) {
      if (next) return next(error);
      throw error;
    }
  }
}
