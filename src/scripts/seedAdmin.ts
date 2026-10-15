import mongoose from 'mongoose';
import { env } from '../config/env';
import { UserModel } from '../models/User.model';
import { ROLES } from '../constants/roles';
import { hashPassword } from '../utils/password.util';
import { logger } from '../utils/logger';

async function seedAdmin(): Promise<void> {
  try {
    logger.info('Connecting to MongoDB for Super Admin seeding...');
    await mongoose.connect(env.MONGODB_URI);

    const email = env.SUPER_ADMIN_EMAIL.toLowerCase().trim();
    const existingAdmin = await UserModel.findOne({ email });

    const hashedPassword = await hashPassword(env.SUPER_ADMIN_PASSWORD);

    if (existingAdmin) {
      existingAdmin.name = env.SUPER_ADMIN_NAME;
      existingAdmin.password = hashedPassword;
      existingAdmin.role = ROLES.SUPER_ADMIN;
      existingAdmin.isActive = true;
      await existingAdmin.save();
      logger.info('Super Admin account already existed — updated and verified successfully.', {
        email,
        role: ROLES.SUPER_ADMIN,
      });
    } else {
      await UserModel.create({
        name: env.SUPER_ADMIN_NAME,
        email,
        password: hashedPassword,
        role: ROLES.SUPER_ADMIN,
        isActive: true,
      });
      logger.info('Super Admin seeded successfully.', {
        email,
        role: ROLES.SUPER_ADMIN,
      });
    }

    await mongoose.disconnect();
    logger.info('Database disconnected. Seeding completed.');
    process.exit(0);
  } catch (error) {
    logger.error('Failed to seed Super Admin:', {
      message: error instanceof Error ? error.message : String(error),
    });
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
}

void seedAdmin();
