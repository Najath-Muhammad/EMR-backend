import { Types } from 'mongoose';
import { RefreshTokenModel, RefreshTokenDocument } from '../../models/RefreshToken.model';
import { IRefreshTokenRepository } from '../interfaces/IRefreshTokenRepository';
import { logger } from '../../utils/logger';

export class RefreshTokenRepository implements IRefreshTokenRepository {
  async create(data: {
    userId: Types.ObjectId | string;
    tokenHash: string;
    family: string;
    expiresAt: Date;
  }): Promise<RefreshTokenDocument> {
    try {
      return await RefreshTokenModel.create(data);
    } catch (error) {
      logger.error('Database error in RefreshTokenRepository.create:', {
        userId: data.userId.toString(),
        family: data.family,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async findByHash(tokenHash: string): Promise<RefreshTokenDocument | null> {
    try {
      return await RefreshTokenModel.findOne({ tokenHash }).exec();
    } catch (error) {
      logger.error('Database error in RefreshTokenRepository.findByHash:', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async revokeById(id: Types.ObjectId | string): Promise<void> {
    try {
      await RefreshTokenModel.findByIdAndUpdate(id, { isRevoked: true }).exec();
    } catch (error) {
      logger.error('Database error in RefreshTokenRepository.revokeById:', {
        id: id.toString(),
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async revokeByHash(tokenHash: string): Promise<void> {
    try {
      await RefreshTokenModel.findOneAndUpdate({ tokenHash }, { isRevoked: true }).exec();
    } catch (error) {
      logger.error('Database error in RefreshTokenRepository.revokeByHash:', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async revokeFamily(family: string): Promise<void> {
    try {
      await RefreshTokenModel.updateMany({ family }, { isRevoked: true }).exec();
    } catch (error) {
      logger.error('Database error in RefreshTokenRepository.revokeFamily:', {
        family,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async revokeAllForUser(userId: Types.ObjectId | string): Promise<void> {
    try {
      await RefreshTokenModel.updateMany({ userId }, { isRevoked: true }).exec();
    } catch (error) {
      logger.error('Database error in RefreshTokenRepository.revokeAllForUser:', {
        userId: userId.toString(),
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
