import { Schema, model, Document, Types } from 'mongoose';
import './User.model';
import './Patient.model';
import './Department.model';

export type AppointmentStatus =
  | 'SCHEDULED'
  | 'CONFIRMED'
  | 'ARRIVED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW'
  | 'PENDING'
  | 'RESCHEDULED';

export interface RescheduleHistoryEntry {
  previousDate: string;
  previousStartTime: string;
  previousEndTime: string;
  rescheduledAt: Date;
  rescheduledBy?: Types.ObjectId | null;
  reason?: string;
}

export interface IAppointment {
  doctor: Types.ObjectId;
  patient?: Types.ObjectId | null;
  patientName?: string;
  department: Types.ObjectId;
  date: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  purpose: string;
  notes?: string;
  createdBy?: Types.ObjectId | null;
  arrivedAt?: Date | null;
  arrivedBy?: Types.ObjectId | null;
  completedAt?: Date | null;
  completedBy?: Types.ObjectId | null;
  consultationNotes?: string;
  cancelledAt?: Date | null;
  cancelledBy?: Types.ObjectId | null;
  cancellationReason?: string;
  rescheduleHistory?: RescheduleHistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export type AppointmentDocument = IAppointment & Document;

const appointmentSchema = new Schema<IAppointment>(
  {
    doctor: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    patient: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      default: null,
      index: true,
    },
    patientName: {
      type: String,
      trim: true,
      default: '',
    },
    department: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
      index: true,
    },
    date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      index: true,
    },
    startTime: {
      type: String,
      required: true,
      match: /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/,
    },
    endTime: {
      type: String,
      required: true,
      match: /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/,
    },
    status: {
      type: String,
      enum: [
        'SCHEDULED',
        'CONFIRMED',
        'ARRIVED',
        'COMPLETED',
        'CANCELLED',
        'NO_SHOW',
        'PENDING',
        'RESCHEDULED',
      ],
      default: 'CONFIRMED',
      index: true,
    },
    purpose: {
      type: String,
      trim: true,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    arrivedAt: {
      type: Date,
      default: null,
    },
    arrivedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    completedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    consultationNotes: {
      type: String,
      trim: true,
      default: '',
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancelledBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    cancellationReason: {
      type: String,
      trim: true,
      default: '',
    },
    rescheduleHistory: [
      {
        previousDate: { type: String, required: true },
        previousStartTime: { type: String, required: true },
        previousEndTime: { type: String, required: true },
        rescheduledAt: { type: Date, default: Date.now },
        rescheduledBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        reason: { type: String, trim: true, default: '' },
      },
    ],
  },
  {
    timestamps: true,
  },
);

appointmentSchema.index(
  { doctor: 1, date: 1, startTime: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['SCHEDULED', 'CONFIRMED', 'ARRIVED'] } },
    name: 'unique_active_doctor_slot',
  },
);

appointmentSchema.index({ patient: 1, date: 1 });
appointmentSchema.index({ department: 1, date: 1 });
appointmentSchema.index({ doctor: 1, date: 1, status: 1 });
appointmentSchema.index({ department: 1, date: 1, status: 1 });
appointmentSchema.index({ date: 1, startTime: 1 });
appointmentSchema.index({ status: 1, date: 1 });

export const AppointmentModel = model<IAppointment>('Appointment', appointmentSchema);
