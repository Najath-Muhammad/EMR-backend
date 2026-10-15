import { Schema, model, Document, Types } from 'mongoose';

export interface IAuditActor {
  userId?: Types.ObjectId;
  email?: string;
  name?: string;
  role?: string;
}

export interface IAuditLog {
  action: string;
  entityType: string;
  entityId?: string;
  actor?: IAuditActor;
  details?: Record<string, unknown>;
  status: 'SUCCESS' | 'FAILURE';
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export interface IAuditLogDocument extends IAuditLog, Document {
  _id: Types.ObjectId;
}

const auditActorSchema = new Schema<IAuditActor>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    email: { type: String, trim: true },
    name: { type: String, trim: true },
    role: { type: String, trim: true },
  },
  { _id: false },
);

const auditLogSchema = new Schema<IAuditLogDocument>(
  {
    action: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    entityType: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    entityId: {
      type: String,
      trim: true,
    },
    actor: {
      type: auditActorSchema,
      default: undefined,
    },
    details: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
    status: {
      type: String,
      enum: ['SUCCESS', 'FAILURE'],
      default: 'SUCCESS',
      index: true,
    },
    ipAddress: {
      type: String,
      trim: true,
    },
    userAgent: {
      type: String,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

// Compound indexes for optimal query performance
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ entityType: 1, createdAt: -1 });
auditLogSchema.index({ 'actor.userId': 1, createdAt: -1 });
auditLogSchema.index({ 'actor.email': 1, createdAt: -1 });

export const AuditLogModel = model<IAuditLogDocument>('AuditLog', auditLogSchema);
