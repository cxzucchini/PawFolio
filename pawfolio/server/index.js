import 'dotenv/config';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { createApp } from './app.js';
let temporary;
let server;
try {
  let uri = process.env.MONGODB_URI;
  if (!uri) {
    if (process.env.NODE_ENV === 'production')
      throw new Error('MONGODB_URI is required in production.');
    console.log(
      'Starting temporary development MongoDB. Data resets when this server stops.',
    );
    temporary = await MongoMemoryServer.create();
    uri = temporary.getUri();
  }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  await Promise.all(
    Object.values(mongoose.models).map((model) => model.init()),
  );
  const app = createApp({ temporaryDatabase: Boolean(temporary) });
  const dist = fileURLToPath(new URL('../dist/', import.meta.url));
  if (process.env.NODE_ENV === 'production' && existsSync(dist)) {
    app.use(express.static(dist));
    app.get(/.*/, (req, res) => res.sendFile(`${dist}index.html`));
  }
  server = app.listen(Number(process.env.PORT) || 4000, '127.0.0.1', () =>
    console.log(
      'Pawfolio API ready at http://127.0.0.1:' + (process.env.PORT || 4000),
    ),
  );
} catch (error) {
  console.error('Could not start Pawfolio:', error.message);
  await mongoose.disconnect();
  await temporary?.stop();
  process.exitCode = 1;
}
let closing = false;
async function stop() {
  if (closing) return;
  closing = true;
  await new Promise((resolve) => (server ? server.close(resolve) : resolve()));
  await mongoose.disconnect();
  await temporary?.stop();
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
