import { ScheduleDocument } from '../models/Schedule.model';
import { ScheduleResponseDto } from '../dtos/schedule.dto';
import { UserDocument } from '../models/User.model';
import { DepartmentDocument } from '../models/Department.model';

export class ScheduleMapper {
  static toResponseDto(doc: ScheduleDocument): ScheduleResponseDto {
    const rawDoctor = doc.doctor as unknown as UserDocument;
    const isDoctorPopulated = rawDoctor && typeof rawDoctor === 'object' && 'name' in rawDoctor;

    let departmentSummary = null;
    if (isDoctorPopulated && rawDoctor.department) {
      const rawDept = rawDoctor.department as unknown as DepartmentDocument;
      if (typeof rawDept === 'object' && 'name' in rawDept) {
        departmentSummary = {
          id: rawDept._id.toString(),
          name: rawDept.name,
          code: rawDept.code,
        };
      }
    }

    return {
      id: doc._id.toString(),
      doctor: {
        id: isDoctorPopulated ? rawDoctor._id.toString() : doc.doctor.toString(),
        name: isDoctorPopulated ? rawDoctor.name : '',
        email: isDoctorPopulated ? rawDoctor.email : '',
        specialization: isDoctorPopulated ? rawDoctor.specialization : undefined,
        department: departmentSummary,
      },
      slotDuration: doc.slotDuration,
      workingDays: doc.workingDays.map((day) => ({
        dayOfWeek: day.dayOfWeek,
        dayName: day.dayName,
        isEnabled: day.isEnabled,
        sessions: day.sessions.map((s) => ({
          startTime: s.startTime,
          endTime: s.endTime,
          label: s.label,
        })),
        breaks: day.breaks.map((b) => ({
          startTime: b.startTime,
          endTime: b.endTime,
          label: b.label,
        })),
      })),
      isActive: doc.isActive,
      createdAt: doc.createdAt ? doc.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: doc.updatedAt ? doc.updatedAt.toISOString() : new Date().toISOString(),
    };
  }
}
