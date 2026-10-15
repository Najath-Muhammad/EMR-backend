import { UserModel, IUser, UserDocument } from '../../models/User.model';
import { IUserRepository } from '../interfaces/IUserRepository';
import { logger } from '../../utils/logger';

export class UserRepository implements IUserRepository {
  async findByEmail(email: string, includePassword = false): Promise<UserDocument | null> {
    try {
      const query = UserModel.findOne({ email: email.toLowerCase().trim() });
      if (includePassword) {
        query.select('+password');
      }
      return await query.exec();
    } catch (error) {
      logger.error('Database error in UserRepository.findByEmail:', {
        email,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async findById(id: string): Promise<UserDocument | null> {
    try {
      return await UserModel.findById(id).exec();
    } catch (error) {
      logger.error('Database error in UserRepository.findById:', {
        id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async create(userData: Partial<IUser>): Promise<UserDocument> {
    try {
      return await UserModel.create(userData);
    } catch (error) {
      logger.error('Database error in UserRepository.create:', {
        email: userData.email,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async updateById(id: string, updateData: Partial<IUser>): Promise<UserDocument | null> {
    try {
      return await UserModel.findByIdAndUpdate(id, updateData, { new: true }).exec();
    } catch (error) {
      logger.error('Database error in UserRepository.updateById:', {
        id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
