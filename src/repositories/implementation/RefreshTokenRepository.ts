import { Types } from 'mongoose';
import { RefreshTokenModel, RefreshTokenDocument } from '../../models/RefreshToken.model';
import { IRefreshTokenRepository } from '../interfaces/IRefreshTokenRepository';

export class RefreshTokenRepository implements IRefreshTokenRepository {
  async create(data: {
    userId: Types.ObjectId | string;
    tokenHash: string;
    family: string;
    expiresAt: Date;
  }): Promise<RefreshTokenDocument> {
    return RefreshTokenModel.create(data);
  }

  async findByHash(tokenHash: string): Promise<RefreshTokenDocument | null> {
    return RefreshTokenModel.findOne({ tokenHash }).exec();
  }

  async revokeById(id: Types.ObjectId | string): Promise<void> {
    await RefreshTokenModel.findByIdAndUpdate(id, { isRevoked: true }).exec();
  }

  async revokeByHash(tokenHash: string): Promise<void> {
    await RefreshTokenModel.findOneAndUpdate({ tokenHash }, { isRevoked: true }).exec();
  }

  async revokeFamily(family: string): Promise<void> {
    await RefreshTokenModel.updateMany({ family }, { isRevoked: true }).exec();
  }

  async revokeAllForUser(userId: Types.ObjectId | string): Promise<void> {
    await RefreshTokenModel.updateMany({ userId }, { isRevoked: true }).exec();
  }
}
