import { AppointmentDocument } from '../models/Appointment.model';
import {
  AppointmentResponseDto,
  PatientRefDto,
  DoctorRefDto,
  DepartmentRefDto,
  StaffRefDto,
} from '../dtos/appointment.dto';

interface PopulatedEntity {
  _id: { toString(): string };
  [key: string]: unknown;
}

export class AppointmentMapper {
  static toResponseDto(doc: AppointmentDocument): AppointmentResponseDto {
    let patientRef: PatientRefDto = {
      id: '',
      patientId: '',
      fullName: doc.patientName || '',
      phone: '',
    };
    if (doc.patient && typeof doc.patient === 'object' && '_id' in (doc.patient as object)) {
      const p = doc.patient as unknown as PopulatedEntity;
      patientRef = {
        id: p._id.toString(),
        patientId: (p['patientId'] as string) || '',
        fullName: (p['fullName'] as string) || doc.patientName || '',
        phone: (p['phone'] as string) || '',
        dateOfBirth: (p['dateOfBirth'] as string) || undefined,
        gender: (p['gender'] as string) || undefined,
      };
    } else if (doc.patient) {
      patientRef = {
        id: doc.patient.toString(),
        patientId: '',
        fullName: doc.patientName || '',
        phone: '',
      };
    }

    let doctorRef: DoctorRefDto = {
      id: '',
      name: '',
      email: '',
    };
    if (doc.doctor && typeof doc.doctor === 'object' && '_id' in (doc.doctor as object)) {
      const d = doc.doctor as unknown as PopulatedEntity;
      doctorRef = {
        id: d._id.toString(),
        name: (d['name'] as string) || '',
        email: (d['email'] as string) || '',
        specialization: (d['specialization'] as string) || undefined,
      };
    } else if (doc.doctor) {
      doctorRef = {
        id: doc.doctor.toString(),
        name: '',
        email: '',
      };
    }

    let departmentRef: DepartmentRefDto = {
      id: '',
      name: '',
      code: '',
    };
    if (doc.department && typeof doc.department === 'object' && '_id' in (doc.department as object)) {
      const dept = doc.department as unknown as PopulatedEntity;
      departmentRef = {
        id: dept._id.toString(),
        name: (dept['name'] as string) || '',
        code: (dept['code'] as string) || '',
      };
    } else if (doc.department) {
      departmentRef = {
        id: doc.department.toString(),
        name: '',
        code: '',
      };
    }

    let createdByRef: StaffRefDto | null = null;
    if (doc.createdBy && typeof doc.createdBy === 'object' && '_id' in (doc.createdBy as object)) {
      const cb = doc.createdBy as unknown as PopulatedEntity;
      createdByRef = {
        id: cb._id.toString(),
        name: (cb['name'] as string) || '',
        email: (cb['email'] as string) || '',
      };
    } else if (doc.createdBy) {
      createdByRef = {
        id: doc.createdBy.toString(),
        name: '',
        email: '',
      };
    }

    let cancelledByRef: StaffRefDto | null = null;
    if (doc.cancelledBy && typeof doc.cancelledBy === 'object' && '_id' in (doc.cancelledBy as object)) {
      const cb = doc.cancelledBy as unknown as PopulatedEntity;
      cancelledByRef = {
        id: cb._id.toString(),
        name: (cb['name'] as string) || '',
        email: (cb['email'] as string) || '',
      };
    } else if (doc.cancelledBy) {
      cancelledByRef = {
        id: doc.cancelledBy.toString(),
        name: '',
        email: '',
      };
    }

    return {
      id: doc._id.toString(),
      patient: patientRef,
      doctor: doctorRef,
      department: departmentRef,
      date: doc.date,
      startTime: doc.startTime,
      endTime: doc.endTime,
      status: doc.status,
      purpose: doc.purpose || '',
      notes: doc.notes || '',
      createdBy: createdByRef,
      cancelledAt: doc.cancelledAt ? doc.cancelledAt.toISOString() : null,
      cancelledBy: cancelledByRef,
      cancellationReason: doc.cancellationReason || '',
      createdAt: doc.createdAt ? doc.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: doc.updatedAt ? doc.updatedAt.toISOString() : new Date().toISOString(),
    };
  }
}
