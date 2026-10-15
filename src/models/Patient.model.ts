import mongoose, { Schema, Document, Types } from 'mongoose';

export type Gender = 'MALE' | 'FEMALE' | 'OTHER';
export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'UNKNOWN';

export interface EmergencyContact {
  name: string;
  phone: string;
  relationship?: string;
}

export interface PatientDocument extends Document {
  patientId: string;
  fullName: string;
  phone: string;
  normalizedPhone: string;
  dateOfBirth: string; // YYYY-MM-DD
  gender: Gender;
  email?: string;
  address?: string;
  emergencyContact?: EmergencyContact;
  bloodGroup?: BloodGroup;
  registrationDepartment?: Types.ObjectId;
  registeredBy: Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const emergencyContactSchema = new Schema<EmergencyContact>(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    relationship: { type: String, trim: true },
  },
  { _id: false },
);

const patientSchema = new Schema<PatientDocument>(
  {
    patientId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    normalizedPhone: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    dateOfBirth: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    gender: {
      type: String,
      enum: ['MALE', 'FEMALE', 'OTHER'],
      required: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    emergencyContact: {
      type: emergencyContactSchema,
    },
    bloodGroup: {
      type: String,
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'UNKNOWN'],
      default: 'UNKNOWN',
    },
    registrationDepartment: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
    },
    registeredBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Compound index for duplicate detection on full name + date of birth
patientSchema.index({ fullName: 1, dateOfBirth: 1 });

export const PatientModel = mongoose.model<PatientDocument>('Patient', patientSchema);
