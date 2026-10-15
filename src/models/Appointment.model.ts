import { Schema, model, Document, Types } from 'mongoose';

export type AppointmentStatus =
  | 'SCHEDULED'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW'
  | 'PENDING'
  | 'RESCHEDULED';

export interface IAppointment {
  doctor: Types.ObjectId;
  patient?: Types.ObjectId | null;
  patientName?: string;
  department: Types.ObjectId;
  date: string;       // YYYY-MM-DD
  startTime: string;  // HH:mm
  endTime: string;    // HH:mm
  status: AppointmentStatus;
  purpose: string;
  notes?: string;
  createdBy?: Types.ObjectId | null;
  cancelledAt?: Date | null;
  cancelledBy?: Types.ObjectId | null;
  cancellationReason?: string;
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
  },
  {
    timestamps: true,
  },
);

// Concurrency & Double-Booking Protection:
// MongoDB partial unique index ensuring no two active appointments exist for the same doctor, date, and startTime
appointmentSchema.index(
  { doctor: 1, date: 1, startTime: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['SCHEDULED', 'CONFIRMED'] } },
    name: 'unique_active_doctor_slot',
  },
);

appointmentSchema.index({ patient: 1, date: 1 });
appointmentSchema.index({ department: 1, date: 1 });

export const AppointmentModel = model<IAppointment>('Appointment', appointmentSchema);
