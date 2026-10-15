import { FilterQuery } from 'mongoose';
import { IPatientRepository } from '../interfaces/IPatientRepository';
import { PatientModel, PatientDocument } from '../../models/Patient.model';
import { SearchPatientsQuery } from '../../validators/patient.validator';
import { normalizePhoneNumber } from '../../utils/phone.util';
import { logger } from '../../utils/logger';

export class PatientRepository implements IPatientRepository {
  async findById(id: string): Promise<PatientDocument | null> {
    try {
      return await PatientModel.findById(id)
        .populate('registrationDepartment', 'name code')
        .populate('registeredBy', 'name email');
    } catch (error) {
      logger.error('Database error in PatientRepository.findById:', {
        id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async findByPatientId(patientId: string): Promise<PatientDocument | null> {
    try {
      return await PatientModel.findOne({ patientId })
        .populate('registrationDepartment', 'name code')
        .populate('registeredBy', 'name email');
    } catch (error) {
      logger.error('Database error in PatientRepository.findByPatientId:', {
        patientId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async findByNormalizedPhone(normalizedPhone: string): Promise<PatientDocument[]> {
    try {
      return await PatientModel.find({ normalizedPhone })
        .populate('registrationDepartment', 'name code')
        .populate('registeredBy', 'name email');
    } catch (error) {
      logger.error('Database error in PatientRepository.findByNormalizedPhone:', {
        normalizedPhone,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async findByNameAndDob(fullName: string, dateOfBirth: string): Promise<PatientDocument[]> {
    try {
      const escapedName = fullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return await PatientModel.find({
        fullName: { $regex: new RegExp(`^${escapedName}$`, 'i') },
        dateOfBirth,
      })
        .populate('registrationDepartment', 'name code')
        .populate('registeredBy', 'name email');
    } catch (error) {
      logger.error('Database error in PatientRepository.findByNameAndDob:', {
        fullName,
        dateOfBirth,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async findByName(fullName: string): Promise<PatientDocument[]> {
    try {
      const escapedName = fullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return await PatientModel.find({
        fullName: { $regex: new RegExp(`^${escapedName}$`, 'i') },
      })
        .populate('registrationDepartment', 'name code')
        .populate('registeredBy', 'name email');
    } catch (error) {
      logger.error('Database error in PatientRepository.findByName:', {
        fullName,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async search(query: SearchPatientsQuery): Promise<{ items: PatientDocument[]; total: number }> {
    try {
      const filter: FilterQuery<PatientDocument> = { isActive: true };

      if (query.gender) {
        filter.gender = query.gender;
      }

      if (query.search && query.search.trim().length > 0) {
        const term = query.search.trim();
        const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const normalizedTerm = normalizePhoneNumber(term);

        const orConditions: Array<FilterQuery<PatientDocument>> = [
          { patientId: { $regex: new RegExp(escapedTerm, 'i') } },
          { fullName: { $regex: new RegExp(escapedTerm, 'i') } },
          { email: { $regex: new RegExp(escapedTerm, 'i') } },
        ];

        if (normalizedTerm.length >= 3) {
          orConditions.push({ normalizedPhone: { $regex: new RegExp(normalizedTerm) } });
        }

        filter.$or = orConditions;
      }

      const sortField = query.sortBy || 'createdAt';
      const sortDir = query.sortOrder === 'asc' ? 1 : -1;

      const [items, total] = await Promise.all([
        PatientModel.find(filter)
          .populate('registrationDepartment', 'name code')
          .populate('registeredBy', 'name email')
          .sort({ [sortField]: sortDir })
          .skip((query.page - 1) * query.limit)
          .limit(query.limit),
        PatientModel.countDocuments(filter),
      ]);

      return { items, total };
    } catch (error) {
      logger.error('Database error in PatientRepository.search:', {
        query,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async findIdsBySearchTerm(term: string): Promise<string[]> {
    try {
      const trimmed = term.trim();
      if (!trimmed) return [];
      const escapedTerm = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const normalizedTerm = normalizePhoneNumber(trimmed);

      const orConditions: Array<FilterQuery<PatientDocument>> = [
        { patientId: { $regex: new RegExp(escapedTerm, 'i') } },
        { fullName: { $regex: new RegExp(escapedTerm, 'i') } },
      ];

      if (normalizedTerm.length >= 3) {
        orConditions.push({ normalizedPhone: { $regex: new RegExp(normalizedTerm) } });
      }

      const docs = await PatientModel.find({ $or: orConditions })
        .select('_id')
        .limit(200)
        .lean();

      return docs.map((d) => (d as unknown as { _id: { toString(): string } })._id.toString());
    } catch (error) {
      logger.error('Database error in PatientRepository.findIdsBySearchTerm:', {
        term,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async create(data: Partial<PatientDocument>): Promise<PatientDocument> {
    try {
      const patient = new PatientModel(data);
      return await patient.save();
    } catch (error) {
      logger.error('Database error in PatientRepository.create:', {
        fullName: data.fullName,
        phone: data.phone,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async updateById(id: string, data: Partial<PatientDocument>): Promise<PatientDocument | null> {
    try {
      return await PatientModel.findByIdAndUpdate(id, { $set: data }, { new: true })
        .populate('registrationDepartment', 'name code')
        .populate('registeredBy', 'name email');
    } catch (error) {
      logger.error('Database error in PatientRepository.updateById:', {
        id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
