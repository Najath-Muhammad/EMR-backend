import { FilterQuery } from 'mongoose';
import { IPatientRepository } from '../interfaces/IPatientRepository';
import { PatientModel, PatientDocument } from '../../models/Patient.model';
import { SearchPatientsQuery } from '../../validators/patient.validator';
import { normalizePhoneNumber } from '../../utils/phone.util';

export class PatientRepository implements IPatientRepository {
  async findById(id: string): Promise<PatientDocument | null> {
    return PatientModel.findById(id)
      .populate('registrationDepartment', 'name code')
      .populate('registeredBy', 'name email');
  }

  async findByPatientId(patientId: string): Promise<PatientDocument | null> {
    return PatientModel.findOne({ patientId })
      .populate('registrationDepartment', 'name code')
      .populate('registeredBy', 'name email');
  }

  async findByNormalizedPhone(normalizedPhone: string): Promise<PatientDocument[]> {
    return PatientModel.find({ normalizedPhone })
      .populate('registrationDepartment', 'name code')
      .populate('registeredBy', 'name email');
  }

  async findByNameAndDob(fullName: string, dateOfBirth: string): Promise<PatientDocument[]> {
    const escapedName = fullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return PatientModel.find({
      fullName: { $regex: new RegExp(`^${escapedName}$`, 'i') },
      dateOfBirth,
    })
      .populate('registrationDepartment', 'name code')
      .populate('registeredBy', 'name email');
  }

  async findByName(fullName: string): Promise<PatientDocument[]> {
    const escapedName = fullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return PatientModel.find({
      fullName: { $regex: new RegExp(`^${escapedName}$`, 'i') },
    })
      .populate('registrationDepartment', 'name code')
      .populate('registeredBy', 'name email');
  }

  async search(query: SearchPatientsQuery): Promise<{ items: PatientDocument[]; total: number }> {
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
  }

  async findIdsBySearchTerm(term: string): Promise<string[]> {
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
  }

  async create(data: Partial<PatientDocument>): Promise<PatientDocument> {
    const patient = new PatientModel(data);
    return patient.save();
  }

  async updateById(id: string, data: Partial<PatientDocument>): Promise<PatientDocument | null> {
    return PatientModel.findByIdAndUpdate(id, { $set: data }, { new: true })
      .populate('registrationDepartment', 'name code')
      .populate('registeredBy', 'name email');
  }
}
