import { Request, Response } from 'express';
import { IPatientController } from '../interfaces/IPatientController';
import { IPatientService } from '../../services/interfaces/IPatientService';
import {
  CreatePatientInput,
  UpdatePatientInput,
  CheckDuplicatesInput,
  SearchPatientsQuery,
} from '../../validators/patient.validator';
import { successResponse } from '../../dtos/ApiResponse';
import { HTTP_STATUS } from '../../constants/httpStatus';
import { MESSAGES } from '../../constants/messages';
import { UnauthorizedError } from '../../errors/AppError';

export class PatientController implements IPatientController {
  constructor(private readonly patientService: IPatientService) {}

  async checkDuplicates(req: Request, res: Response): Promise<void> {
    const input = req.body as CheckDuplicatesInput;
    const result = await this.patientService.checkPotentialDuplicates(input);
    res.status(HTTP_STATUS.OK).json(
      successResponse(
        result.hasMatches ? MESSAGES.PATIENT_DUPLICATE_FOUND : MESSAGES.OPERATION_SUCCESS,
        result,
      ),
    );
  }

  async createPatient(req: Request, res: Response): Promise<void> {
    if (!req.user?.userId) {
      throw new UnauthorizedError(MESSAGES.UNAUTHORIZED);
    }

    const input = req.body as CreatePatientInput;
    const data = await this.patientService.createPatient(input, req.user.userId);
    res.status(HTTP_STATUS.CREATED).json(successResponse(MESSAGES.PATIENT_CREATED, data));
  }

  async getPatients(req: Request, res: Response): Promise<void> {
    const query = req.query as unknown as SearchPatientsQuery;
    const result = await this.patientService.getPatients(query);

    res.status(HTTP_STATUS.OK).json(
      successResponse(MESSAGES.PATIENTS_FETCHED, result.items, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      }),
    );
  }

  async getPatientById(req: Request, res: Response): Promise<void> {
    const id = req.params['id'] as string;
    const data = await this.patientService.getPatientById(id);
    res.status(HTTP_STATUS.OK).json(successResponse(MESSAGES.PATIENT_FETCHED, data));
  }

  async updatePatient(req: Request, res: Response): Promise<void> {
    const id = req.params['id'] as string;
    const input = req.body as UpdatePatientInput;
    const data = await this.patientService.updatePatient(id, input);
    res.status(HTTP_STATUS.OK).json(successResponse(MESSAGES.PATIENT_UPDATED, data));
  }
}
