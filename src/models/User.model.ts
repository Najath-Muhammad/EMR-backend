import { Schema, model, Types, HydratedDocument } from 'mongoose';
import { ALL_ROLES, Role, ROLES } from '../constants/roles';

export interface IUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  password?: string;
  role: Role;
  department?: Types.ObjectId | null;
  phone?: string;
  specialization?: string;
  isActive: boolean;
  isActivated: boolean;
  activationTokenHash?: string;
  activationTokenExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<IUser>;

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      select: false,
    },
    role: {
      type: String,
      enum: ALL_ROLES,
      required: true,
      default: ROLES.DOCTOR,
    },
    department: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    specialization: {
      type: String,
      trim: true,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isActivated: {
      type: Boolean,
      default: false,
      index: true,
    },
    activationTokenHash: {
      type: String,
      select: false,
    },
    activationTokenExpiresAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

userSchema.index(
  { department: 1 },
  {
    unique: true,
    partialFilterExpression: {
      role: ROLES.RECEPTIONIST,
      isActive: true,
      department: { $type: 'objectId' },
    },
  },
);

export const UserModel = model<IUser>('User', userSchema);
