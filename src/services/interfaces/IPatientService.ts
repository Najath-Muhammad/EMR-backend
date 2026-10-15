import {
  CreatePatientInput,
  UpdatePatientInput,
  CheckDuplicatesInput,
  SearchPatientsQuery,
} from '../../validators/patient.validator';
import {
  PatientResponseDto,
  DuplicateCheckResponseDto,
} from '../../dtos/patient.dto';

export interface PaginatedPatientsResult {
  items: PatientResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface IPatientService {
  checkPotentialDuplicates(data: CheckDuplicatesInput): Promise<DuplicateCheckResponseDto>;
  createPatient(data: CreatePatientInput, staffUserId: string): Promise<PatientResponseDto>;
  getPatients(query: SearchPatientsQuery): Promise<PaginatedPatientsResult>;
  getPatientById(id: string): Promise<PatientResponseDto>;
  updatePatient(id: string, data: UpdatePatientInput): Promise<PatientResponseDto>;
}
