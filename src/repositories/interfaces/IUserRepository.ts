import { IUser, UserDocument } from '../../models/User.model';

export interface IUserRepository {
  findByEmail(email: string, includePassword?: boolean): Promise<UserDocument | null>;
  findById(id: string): Promise<UserDocument | null>;
  create(userData: Partial<IUser>): Promise<UserDocument>;
  updateById(id: string, updateData: Partial<IUser>): Promise<UserDocument | null>;
}
