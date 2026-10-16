import { Types } from 'mongoose';
import { IPatientService, PaginatedPatientsResult } from '../interfaces/IPatientService';
import { IPatientRepository } from '../../repositories/interfaces/IPatientRepository';
import { IDepartmentRepository } from '../../repositories/interfaces/IDepartmentRepository';
import {
  CreatePatientInput,
  UpdatePatientInput,
  CheckDuplicatesInput,
  SearchPatientsQuery,
} from '../../validators/patient.validator';
import {
  PatientResponseDto,
  PossibleDuplicateDto,
  DuplicateCheckResponseDto,
} from '../../dtos/patient.dto';
import { PatientMapper } from '../../mappers/patient.mapper';
import { getNextSequence } from '../../models/Counter.model';
import { normalizePhoneNumber, formatPhoneDisplay } from '../../utils/phone.util';
import { NotFoundError, BadRequestError, ConflictError } from '../../errors/AppError';
import { MESSAGES } from '../../constants/messages';

export class PatientService implements IPatientService {
  constructor(
    private readonly _patientRepo: IPatientRepository,
    private readonly _departmentRepo?: IDepartmentRepository,
  ) {}

  async checkPotentialDuplicates(data: CheckDuplicatesInput): Promise<DuplicateCheckResponseDto> {
    try {
      const normalizedPhone = normalizePhoneNumber(data.phone);
      const matchesMap = new Map<string, PossibleDuplicateDto>();

      if (normalizedPhone.length >= 7) {
        const phoneMatches = await this._patientRepo.findByNormalizedPhone(normalizedPhone);
        for (const match of phoneMatches) {
          const id = match._id.toString();
          const reason = `Matches mobile phone number (${formatPhoneDisplay(match.phone)})`;

          if (!matchesMap.has(id)) {
            matchesMap.set(id, {
              patient: PatientMapper.toResponseDto(match),
              matchReasons: [reason],
              confidence: 'HIGH',
            });
          } else {
            matchesMap.get(id)!.matchReasons.push(reason);
          }
        }
      }

      if (data.fullName && data.dateOfBirth) {
        const nameDobMatches = await this._patientRepo.findByNameAndDob(
          data.fullName.trim(),
          data.dateOfBirth,
        );

        for (const match of nameDobMatches) {
          const id = match._id.toString();
          const reason = `Exact match on full name and date of birth (${match.dateOfBirth})`;

          if (!matchesMap.has(id)) {
            matchesMap.set(id, {
              patient: PatientMapper.toResponseDto(match),
              matchReasons: [reason],
              confidence: 'HIGH',
            });
          } else {
            const entry = matchesMap.get(id)!;
            if (!entry.matchReasons.includes(reason)) {
              entry.matchReasons.push(reason);
            }
          }
        }
      }

      const duplicates = Array.from(matchesMap.values());
      return {
        hasMatches: duplicates.length > 0,
        duplicates,
      };
    } catch (error) {
      throw error;
    }
  }

  async createPatient(data: CreatePatientInput, staffUserId: string): Promise<PatientResponseDto> {
    try {
      let deptObjectId: Types.ObjectId | undefined;
      if (data.registrationDepartment && data.registrationDepartment.trim().length > 0) {
        if (this._departmentRepo) {
          const dept = await this._departmentRepo.findById(data.registrationDepartment);
          if (!dept) {
            throw new BadRequestError(MESSAGES.DEPARTMENT_INVALID);
          }
        }
        deptObjectId = new Types.ObjectId(data.registrationDepartment);
      }

      const normalizedPhone = normalizePhoneNumber(data.phone);
      if (!normalizedPhone || normalizedPhone.length < 7) {
        throw new BadRequestError('Invalid phone number format');
      }

      const currentYear = new Date().getFullYear();
      let attempts = 0;
      const maxAttempts = 10;

      while (attempts < maxAttempts) {
        attempts++;
        const seq = await getNextSequence(`patient_id_${currentYear}`);
        const patientId = `PAT-${currentYear}-${String(seq).padStart(5, '0')}`;

        try {
          const created = await this._patientRepo.create({
            patientId,
            fullName: data.fullName.trim(),
            phone: data.phone.trim(),
            normalizedPhone,
            dateOfBirth: data.dateOfBirth,
            gender: data.gender,
            email: data.email ? data.email.trim().toLowerCase() : undefined,
            address: data.address ? data.address.trim() : undefined,
            emergencyContact: data.emergencyContact,
            bloodGroup: data.bloodGroup || 'UNKNOWN',
            registrationDepartment: deptObjectId,
            registeredBy: new Types.ObjectId(staffUserId),
            isActive: true,
          });

          const populated = await this._patientRepo.findById(created._id.toString());
          return PatientMapper.toResponseDto(populated ?? created);
        } catch (error: unknown) {
          const err = error as { code?: number; keyPattern?: Record<string, number> };
          if (err.code === 11000 && err.keyPattern && err.keyPattern['patientId']) {
            if (attempts < maxAttempts) {
              continue;
            }
            throw new ConflictError(MESSAGES.PATIENT_ID_EXISTS);
          }
          throw error;
        }
      }

      throw new ConflictError(MESSAGES.PATIENT_ID_EXISTS);
    } catch (error) {
      throw error;
    }
  }

  async getPatients(query: SearchPatientsQuery): Promise<PaginatedPatientsResult> {
    try {
      const { items, total } = await this._patientRepo.search(query);
      const totalPages = Math.ceil(total / query.limit) || 1;

      return {
        items: items.map((doc) => PatientMapper.toResponseDto(doc)),
        total,
        page: query.page,
        limit: query.limit,
        totalPages,
      };
    } catch (error) {
      throw error;
    }
  }

  async getPatientById(id: string): Promise<PatientResponseDto> {
    try {
      let patient = null;
      if (Types.ObjectId.isValid(id) && new Types.ObjectId(id).toString() === id) {
        patient = await this._patientRepo.findById(id);
      }
      if (!patient) {
        patient = await this._patientRepo.findByPatientId(id);
      }

      if (!patient) {
        throw new NotFoundError(MESSAGES.PATIENT_NOT_FOUND);
      }

      return PatientMapper.toResponseDto(patient);
    } catch (error) {
      throw error;
    }
  }

  async updatePatient(id: string, data: UpdatePatientInput): Promise<PatientResponseDto> {
    try {
      const existing = await this._patientRepo.findById(id);
      if (!existing) {
        throw new NotFoundError(MESSAGES.PATIENT_NOT_FOUND);
      }

      const updateData: Record<string, unknown> = {};

      if (data.fullName !== undefined) updateData['fullName'] = data.fullName.trim();
      if (data.phone !== undefined) {
        updateData['phone'] = data.phone.trim();
        updateData['normalizedPhone'] = normalizePhoneNumber(data.phone);
      }
      if (data.dateOfBirth !== undefined) updateData['dateOfBirth'] = data.dateOfBirth;
      if (data.gender !== undefined) updateData['gender'] = data.gender;
      if (data.email !== undefined) updateData['email'] = data.email ? data.email.trim().toLowerCase() : undefined;
      if (data.address !== undefined) updateData['address'] = data.address ? data.address.trim() : undefined;
      if (data.emergencyContact !== undefined) updateData['emergencyContact'] = data.emergencyContact;
      if (data.bloodGroup !== undefined) updateData['bloodGroup'] = data.bloodGroup;
      if (data.registrationDepartment !== undefined) {
        updateData['registrationDepartment'] = data.registrationDepartment
          ? new Types.ObjectId(data.registrationDepartment)
          : undefined;
      }

      const updated = await this._patientRepo.updateById(id, updateData);
      if (!updated) {
        throw new NotFoundError(MESSAGES.PATIENT_NOT_FOUND);
      }

      return PatientMapper.toResponseDto(updated);
    } catch (error) {
      throw error;
    }
  }
}
