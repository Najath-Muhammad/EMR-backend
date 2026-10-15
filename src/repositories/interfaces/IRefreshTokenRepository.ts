import { Types } from 'mongoose';
import { RefreshTokenDocument } from '../../models/RefreshToken.model';

export interface IRefreshTokenRepository {
  create(data: {
    userId: Types.ObjectId | string;
    tokenHash: string;
    family: string;
    expiresAt: Date;
  }): Promise<RefreshTokenDocument>;
  findByHash(tokenHash: string): Promise<RefreshTokenDocument | null>;
  revokeById(id: Types.ObjectId | string): Promise<void>;
  revokeByHash(tokenHash: string): Promise<void>;
  revokeFamily(family: string): Promise<void>;
  revokeAllForUser(userId: Types.ObjectId | string): Promise<void>;
}
