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
    private readonly patientRepo: IPatientRepository,
    private readonly departmentRepo?: IDepartmentRepository,
  ) {}

  async checkPotentialDuplicates(data: CheckDuplicatesInput): Promise<DuplicateCheckResponseDto> {
    const normalizedPhone = normalizePhoneNumber(data.phone);
    const matchesMap = new Map<string, PossibleDuplicateDto>();

    // 1. Check for matching phone number (High likelihood of duplicate or shared family number)
    if (normalizedPhone.length >= 7) {
      const phoneMatches = await this.patientRepo.findByNormalizedPhone(normalizedPhone);
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

    // 2. Check for matching full name AND date of birth (Rule 4: Never treat name alone as proof)
    if (data.fullName && data.dateOfBirth) {
      const nameDobMatches = await this.patientRepo.findByNameAndDob(
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
  }

  async createPatient(data: CreatePatientInput, staffUserId: string): Promise<PatientResponseDto> {
    // If registration department is specified, verify it exists
    let deptObjectId: Types.ObjectId | undefined;
    if (data.registrationDepartment && data.registrationDepartment.trim().length > 0) {
      if (this.departmentRepo) {
        const dept = await this.departmentRepo.findById(data.registrationDepartment);
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

    // Generate unique Patient ID (e.g. PAT-2026-00001) using atomic sequence counter
    const currentYear = new Date().getFullYear();
    const seq = await getNextSequence(`patient_id_${currentYear}`);
    const patientId = `PAT-${currentYear}-${String(seq).padStart(5, '0')}`;

    try {
      const created = await this.patientRepo.create({
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

      // Refetch with populated department and staff
      const populated = await this.patientRepo.findById(created._id.toString());
      return PatientMapper.toResponseDto(populated ?? created);
    } catch (error: unknown) {
      const err = error as { code?: number; keyPattern?: Record<string, number> };
      if (err.code === 11000 && err.keyPattern && err.keyPattern['patientId']) {
        throw new ConflictError(MESSAGES.PATIENT_ID_EXISTS);
      }
      throw error;
    }
  }

  async getPatients(query: SearchPatientsQuery): Promise<PaginatedPatientsResult> {
    const { items, total } = await this.patientRepo.search(query);
    const totalPages = Math.ceil(total / query.limit) || 1;

    return {
      items: items.map((doc) => PatientMapper.toResponseDto(doc)),
      total,
      page: query.page,
      limit: query.limit,
      totalPages,
    };
  }

  async getPatientById(id: string): Promise<PatientResponseDto> {
    let patient = null;
    if (Types.ObjectId.isValid(id) && new Types.ObjectId(id).toString() === id) {
      patient = await this.patientRepo.findById(id);
    }
    if (!patient) {
      // Also allow searching by human-readable patientId (e.g. PAT-2026-00001)
      patient = await this.patientRepo.findByPatientId(id);
    }

    if (!patient) {
      throw new NotFoundError(MESSAGES.PATIENT_NOT_FOUND);
    }

    return PatientMapper.toResponseDto(patient);
  }

  async updatePatient(id: string, data: UpdatePatientInput): Promise<PatientResponseDto> {
    const existing = await this.patientRepo.findById(id);
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

    const updated = await this.patientRepo.updateById(id, updateData);
    if (!updated) {
      throw new NotFoundError(MESSAGES.PATIENT_NOT_FOUND);
    }

    return PatientMapper.toResponseDto(updated);
  }
}
