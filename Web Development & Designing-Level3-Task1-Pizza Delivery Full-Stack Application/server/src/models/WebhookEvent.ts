import { Schema, model } from 'mongoose';

/** Records processed webhook deliveries so retries are acknowledged without reprocessing. */
const schema = new Schema(
  {
    eventId: { type: String, required: true, unique: true },
    event: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
schema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

export const WebhookEvent = model('WebhookEvent', schema);
