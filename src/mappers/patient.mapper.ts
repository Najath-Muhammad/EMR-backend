import { PatientDocument } from '../models/Patient.model';
import { PatientResponseDto, DepartmentRefDto, StaffRefDto } from '../dtos/patient.dto';

interface PopulatedDepartment {
  _id: { toString(): string };
  name: string;
  code: string;
}

interface PopulatedStaff {
  _id: { toString(): string };
  name: string;
  email: string;
}

export class PatientMapper {
  static toResponseDto(doc: PatientDocument): PatientResponseDto {
    let departmentRef: DepartmentRefDto | null = null;
    if (doc.registrationDepartment && typeof doc.registrationDepartment === 'object' && 'name' in doc.registrationDepartment) {
      const dept = doc.registrationDepartment as unknown as PopulatedDepartment;
      departmentRef = {
        id: dept._id.toString(),
        name: dept.name,
        code: dept.code,
      };
    } else if (doc.registrationDepartment) {
      departmentRef = {
        id: doc.registrationDepartment.toString(),
        name: '',
        code: '',
      };
    }

    let staffRef: StaffRefDto | null = null;
    if (doc.registeredBy && typeof doc.registeredBy === 'object' && 'name' in doc.registeredBy) {
      const staff = doc.registeredBy as unknown as PopulatedStaff;
      staffRef = {
        id: staff._id.toString(),
        name: staff.name,
        email: staff.email,
      };
    } else if (doc.registeredBy) {
      staffRef = {
        id: doc.registeredBy.toString(),
        name: '',
        email: '',
      };
    }

    return {
      id: doc._id.toString(),
      patientId: doc.patientId,
      fullName: doc.fullName,
      phone: doc.phone,
      normalizedPhone: doc.normalizedPhone,
      dateOfBirth: doc.dateOfBirth,
      gender: doc.gender,
      email: doc.email,
      address: doc.address,
      emergencyContact: doc.emergencyContact,
      bloodGroup: doc.bloodGroup ?? 'UNKNOWN',
      registrationDepartment: departmentRef,
      registeredBy: staffRef,
      isActive: doc.isActive,
      createdAt: doc.createdAt ? doc.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: doc.updatedAt ? doc.updatedAt.toISOString() : new Date().toISOString(),
    };
  }
}
