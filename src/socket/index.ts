import http from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { UserModel } from '../models/User.model';
import { ROLES, Role } from '../constants/roles';
import { realtimeService } from '../services/implementation/RealtimeService';

export interface AuthenticatedSocketUser {
  userId: string;
  role: Role;
  departmentId?: string;
  email: string;
}

export function initSocket(httpServer: http.Server): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.CORS_ORIGINS.split(',').map((o) => o.trim()),
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.use(async (socket: Socket, next) => {
    try {
      const rawToken =
        (socket.handshake.auth?.['token'] as string | undefined) ||
        (socket.handshake.headers?.['authorization'] as string | undefined);

      if (!rawToken) {
        return next(new Error('Authentication error: Token required'));
      }

      const token = rawToken.startsWith('Bearer ') ? rawToken.slice(7) : rawToken;
      const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string; role: Role };

      if (!decoded?.userId) {
        return next(new Error('Authentication error: Invalid token'));
      }

      const user = await UserModel.findById(decoded.userId).lean();
      if (!user || !user.isActive) {
        return next(new Error('Authentication error: User inactive or not found'));
      }

      const departmentId = user.department ? user.department.toString() : undefined;

      socket.data.user = {
        userId: user._id.toString(),
        role: user.role as Role,
        departmentId,
        email: user.email,
      };

      next();
    } catch {
      next(new Error('Authentication error: Token verification failed'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user: AuthenticatedSocketUser | undefined = socket.data.user;
    if (!user) {
      socket.disconnect(true);
      return;
    }

    logger.debug(`Socket connected: ${socket.id}`, {
      userId: user.userId,
      role: user.role,
      departmentId: user.departmentId,
    });

    if (user.role === ROLES.SUPER_ADMIN) {
      void socket.join('role:SUPER_ADMIN');
    } else if (user.role === ROLES.RECEPTIONIST) {
      if (user.departmentId) {
        void socket.join(`department:${user.departmentId}`);
      }
    } else if (user.role === ROLES.DOCTOR) {
      void socket.join(`doctor:${user.userId}`);
    }

    socket.on('disconnect', (reason) => {
      logger.debug(`Socket disconnected: ${socket.id}`, { reason });
    });
  });

  realtimeService.setIO(io);

  return io;
}
