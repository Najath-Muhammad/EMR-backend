import { Schema, model, Document, Types } from 'mongoose';

export interface ISession {
  startTime: string;
  endTime: string;
  label?: string;
}

export interface IBreak {
  startTime: string;
  endTime: string;
  label?: string;
}

export interface IWorkingDay {
  dayOfWeek: number;
  dayName: string;
  isEnabled: boolean;
  sessions: ISession[];
  breaks: IBreak[];
}

export interface ISchedule {
  doctor: Types.ObjectId;
  slotDuration: number;
  workingDays: IWorkingDay[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type ScheduleDocument = ISchedule & Document;

const sessionSchema = new Schema<ISession>(
  {
    startTime: {
      type: String,
      required: true,
      trim: true,
      match: /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/,
    },
    endTime: {
      type: String,
      required: true,
      trim: true,
      match: /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/,
    },
    label: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { _id: false },
);

const breakSchema = new Schema<IBreak>(
  {
    startTime: {
      type: String,
      required: true,
      trim: true,
      match: /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/,
    },
    endTime: {
      type: String,
      required: true,
      trim: true,
      match: /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/,
    },
    label: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { _id: false },
);

const workingDaySchema = new Schema<IWorkingDay>(
  {
    dayOfWeek: {
      type: Number,
      required: true,
      min: 0,
      max: 6,
    },
    dayName: {
      type: String,
      required: true,
      enum: ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'],
    },
    isEnabled: {
      type: Boolean,
      default: true,
    },
    sessions: {
      type: [sessionSchema],
      default: [],
    },
    breaks: {
      type: [breakSchema],
      default: [],
    },
  },
  { _id: false },
);

const scheduleSchema = new Schema<ISchedule>(
  {
    doctor: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    slotDuration: {
      type: Number,
      required: true,
      default: 15,
      min: 5,
      max: 120,
    },
    workingDays: {
      type: [workingDaySchema],
      required: true,
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

export const ScheduleModel = model<ISchedule>('Schedule', scheduleSchema);
