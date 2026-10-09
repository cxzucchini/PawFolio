import mongoose from 'mongoose';
import { createApp } from '../server/app.js';

const app = createApp();
let connection;
export default async function handler(req, res) {
  if (!process.env.MONGODB_URI)
    return res
      .status(503)
      .json({ message: 'Set MONGODB_URI in Vercel to connect Pawfolio.' });
  try {
    if (!connection)
      connection = mongoose
        .connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
        .then(async () => {
          await Promise.all(
            Object.values(mongoose.models).map((model) => model.init()),
          );
        })
        .catch((error) => {
          connection = undefined;
          throw error;
        });
    await connection;
  } catch {
    return res
      .status(503)
      .json({
        message:
          'Pawfolio cannot connect to its database. Check the Atlas connection and network access settings.',
      });
  }
  return app(req, res);
}
