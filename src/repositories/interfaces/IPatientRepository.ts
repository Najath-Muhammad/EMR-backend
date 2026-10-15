import { PatientDocument } from '../../models/Patient.model';
import { SearchPatientsQuery } from '../../validators/patient.validator';

export interface IPatientRepository {
  findById(id: string): Promise<PatientDocument | null>;
  findByPatientId(patientId: string): Promise<PatientDocument | null>;
  findByNormalizedPhone(normalizedPhone: string): Promise<PatientDocument[]>;
  findByNameAndDob(fullName: string, dateOfBirth: string): Promise<PatientDocument[]>;
  findByName(fullName: string): Promise<PatientDocument[]>;
  search(query: SearchPatientsQuery): Promise<{ items: PatientDocument[]; total: number }>;
  create(data: Partial<PatientDocument>): Promise<PatientDocument>;
  updateById(id: string, data: Partial<PatientDocument>): Promise<PatientDocument | null>;
}
