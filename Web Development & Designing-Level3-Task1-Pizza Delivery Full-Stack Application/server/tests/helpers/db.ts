import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import '../../src/models';

let server: MongoMemoryServer | undefined;

export async function startDb() {
  server = await MongoMemoryServer.create();
  await mongoose.connect(server.getUri('pizza_test'));
  // Build unique/partial indexes up-front: idempotency guarantees depend on them.
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
}
export async function stopDb() {
  await mongoose.disconnect();
  await server?.stop();
}
export async function clearDb() {
  await Promise.all(Object.values(mongoose.models).map((m) => m.deleteMany({})));
}
