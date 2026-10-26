import mongoose from 'mongoose';
import { env } from './env';
import { logger } from '../utils/logger';

mongoose.set('strictQuery', true);

export async function connectDb(uri: string = env.MONGODB_URI): Promise<void> {
  mongoose.connection.on('error', (err) => logger.error('MongoDB connection error', { err }));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
    logger.info('MongoDB connected');
  } catch (err) {
    logger.error('Could not connect to MongoDB. Check MONGODB_URI and that the server is running.', { err });
    throw err;
  }
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}

export async function isDbReady(): Promise<boolean> {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) return false;
  try {
    await mongoose.connection.db.admin().ping();
    return true;
  } catch {
    return false;
  }
}
