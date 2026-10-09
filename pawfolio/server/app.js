import express from 'express';
import cookieParser from 'cookie-parser';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import {
  randomBytes,
  randomInt,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from 'node:crypto';
import { promisify } from 'node:util';
import {
  resetMailConfigured,
  sendResetEmail,
  sendContactEmail,
  contactMailConfigured,
  logMailFailure,
} from './mail.js';
import { validNewPassword, passwordRequirements } from '../shared/password.js';
import { photoInput } from './photos.js';
import { advanceOptions, defaultAdvance } from '../shared/reminderTiming.js';
import { futureDate } from '../shared/calendarDate.js';
import {
  User,
  Session,
  Dog,
  Vaccination,
  Reminder,
  MedicalRecord,
  EmergencyProfile,
} from './models.js';
const scrypt = promisify(scryptCallback);
const tokenHash = (token) => createHash('sha256').update(token).digest('hex');
const asyncRoute = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);
const COOKIE = 'pawfolio_session';
const production = process.env.NODE_ENV === 'production';
const cookieOptions = {
  httpOnly: true,
  sameSite: 'strict',
  secure: production,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};
const safeUser = (user) => ({
  id: user.id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  username: user.username,
});
function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
function text(value, label, max = 100, required = false) {
  if (value === undefined || value === null) {
    if (required) fail(`${label} is required.`);
    return '';
  }
  if (typeof value !== 'string') fail(`${label} must be text.`);
  const result = value.trim();
  if (required && !result) fail(`${label} is required.`);
  if (result.length > max) fail(`${label} is too long.`);
  return result;
}
function date(value, label, required = false) {
  if (!value) {
    if (required) fail(`${label} is required.`);
    return undefined;
  }
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(value))
    fail(`${label} is invalid.`);
  const result = new Date(value);
  if (!Number.isFinite(result.getTime())) fail(`${label} is invalid.`);
  if (value.length === 10 && result.toISOString().slice(0, 10) !== value)
    fail(`${label} is invalid.`);
  return result;
}
function dogInput(body, timeZone) {
  const birth = date(body.dateOfBirth, 'Date of birth', true);
  if (
    (body.dateOfBirth.length === 10
      ? futureDate(body.dateOfBirth, timeZone)
      : birth > new Date()) ||
    birth < new Date('1990-01-01')
  )
    fail('Enter a valid dog date of birth.');
  const gender = body.gender || 'Unknown';
  if (!['Male', 'Female', 'Unknown'].includes(gender))
    fail('Choose a valid gender.');
  let weight;
  if (body.weight !== '' && body.weight !== undefined && body.weight !== null) {
    weight = Number(body.weight);
    if (!Number.isFinite(weight) || weight < 0.1 || weight > 150)
      fail('Weight must be between 0.1 and 150 kg.');
  }
  return {
    ...(body.photo !== undefined ? { photo: photoInput(body.photo) } : {}),
    name: text(body.name, 'Dog name', 60, true),
    breed: text(body.breed, 'Breed', 100, true),
    dateOfBirth: birth,
    gender,
    weight: weight ?? null,
    microchip: text(body.microchip, 'Microchip number', 30),
    veterinarian: text(body.veterinarian, 'Veterinarian', 100),
  };
}

export function createApp({
  temporaryDatabase = false,
  authRateLimit = true,
  resetMailer,
  contactMailer,
} = {}) {
  const app = express();
  app.disable('x-powered-by');
  if (process.env.VERCEL) app.set('trust proxy', 1);
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    if (req.path.startsWith('/api/'))
      res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(express.json({ limit: '800kb' }));
  app.use(cookieParser());
  app.use('/api', (req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const allowed = process.env.CLIENT_ORIGIN || 'http://127.0.0.1:5173';
      const localOrigins = production
        ? [process.env.VERCEL_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]
            .filter(Boolean)
            .map((host) => `https://${host}`)
        : ['http://localhost:5173', 'http://127.0.0.1:5173'];
      if (
        req.headers.origin &&
        ![allowed, ...localOrigins].includes(req.headers.origin)
      )
        return res
          .status(403)
          .json({ message: 'This request is not allowed.' });
      if (req.headers['sec-fetch-site'] === 'cross-site')
        return res
          .status(403)
          .json({ message: 'This request is not allowed.' });
    }
    next();
  });
  if (authRateLimit)
    app.use(
      ['/api/auth/login', '/api/auth/register'],
      rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 30,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        message: {
          message: 'Too many attempts. Please try again in 15 minutes.',
        },
      }),
    );
  const requireUser = asyncRoute(async (req, res, next) => {
    const token = req.cookies[COOKIE];
    if (!token || typeof token !== 'string')
      return res.status(401).json({ message: 'Please log in to continue.' });
    const session = await Session.findOne({
      tokenHash: tokenHash(token),
      expiresAt: { $gt: new Date() },
    }).populate('user');
    if (!session?.user)
      return res
        .status(401)
        .json({ message: 'Your session has ended. Please log in again.' });
    if (
      ['preview@pawfolio.invalid', 'public-preview@pawfolio.invalid'].includes(
        session.user.email,
      )
    ) {
      await Session.deleteOne({ _id: session._id });
      res.clearCookie(COOKIE, {
        httpOnly: true,
        sameSite: 'strict',
        secure: production,
        path: '/',
      });
      return res.status(401).json({
        message:
          'Preview access has ended. Please log in or create an account.',
      });
    }
    req.user = session.user;
    req.session = session;
    next();
  });
  const ownDog = asyncRoute(async (req, res, next) => {
    if (!/^[a-f\d]{24}$/i.test(req.params.dogId))
      return res.status(404).json({ message: 'Dog not found.' });
    const dog = await Dog.findOne({
      _id: req.params.dogId,
      owner: req.user._id,
    });
    if (!dog) return res.status(404).json({ message: 'Dog not found.' });
    req.dog = dog;
    next();
  });
  app.post(
    ['/api/contact', '/api/contact/public'],
    (req, res, next) =>
      req.path.endsWith('/public') ? next() : requireUser(req, res, next),
    rateLimit({
      windowMs: 60 * 60 * 1000,
      limit: 5,
      keyGenerator: (req) => (req.user ? req.user.id : ipKeyGenerator(req.ip)),
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: {
        message: 'You have sent several messages. Please try again in an hour.',
      },
    }),
    asyncRoute(async (req, res) => {
      const body = req.body || {};
      const topic = text(body.topic, 'Topic', 40, true);
      if (
        ![
          'General question',
          'Account help',
          'Report a problem',
          'Feedback',
        ].includes(topic)
      )
        fail('Choose a valid topic.');
      const subject = text(body.subject, 'Subject', 120, true);
      if (/[\r\n]/.test(subject)) fail('Subject must be a single line.');
      const message = text(body.message, 'Message', 3000, true);
      const name = req.user
        ? `${req.user.firstName} ${req.user.lastName}`
        : text(body.name, 'Name', 120, true);
      const email = req.user
        ? req.user.email
        : text(body.email, 'Email', 254, true).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        fail('Enter a valid email address.');
      if (message.length < 10)
        fail('Please describe your message in at least 10 characters.');
      if (!contactMailer && !contactMailConfigured())
        fail(
          'Contact messaging is temporarily unavailable. Please try again later.',
          503,
        );
      try {
        await (contactMailer || sendContactEmail)({
          name,
          email,
          topic,
          subject,
          message,
        });
      } catch (error) {
        logMailFailure('contact', error);
        fail(
          'Your message could not be sent. Please try again. Your text has been kept.',
          503,
        );
      }
      res.json({
        message: 'Your message has been sent. We will reply to your email.',
      });
    }),
  );
  async function openSession(user, req, res) {
    if (typeof req.cookies[COOKIE] === 'string')
      await Session.deleteOne({ tokenHash: tokenHash(req.cookies[COOKIE]) });
    const token = randomBytes(32).toString('hex');
    await Session.create({
      tokenHash: tokenHash(token),
      user: user._id,
      expiresAt: new Date(Date.now() + cookieOptions.maxAge),
    });
    res.cookie(COOKIE, token, cookieOptions);
  }
  app.get('/api/health', (req, res) =>
    res.json({ ok: true, temporaryDatabase }),
  );
  if (authRateLimit)
    app.use(
      ['/api/auth/forgot-password', '/api/auth/reset-password'],
      rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 10,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
      }),
    );
  app.post(
    '/api/auth/forgot-password',
    asyncRoute(async (req, res) => {
      const email = text(req.body?.email, 'Email', 254, true).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        fail('Enter a valid email address.');
      if (!resetMailer && !resetMailConfigured())
        fail(
          'Password recovery email is not available yet. Please try again later.',
          503,
        );
      const token = String(randomInt(0, 1000000)).padStart(6, '0');
      const user = await User.findOneAndUpdate(
        { email },
        {
          $set: {
            resetTokenHash: tokenHash(`${email}:${token}`),
            resetExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
            resetAttempts: 0,
          },
        },
      );
      if (user) {
        try {
          await (resetMailer || sendResetEmail)(email, token);
        } catch {
          console.error('Password recovery email delivery failed.');
        }
      }
      res.json({
        message:
          'If an account matches that email, a six-digit reset code will be sent. Check your inbox and spam folder.',
      });
    }),
  );
  app.post(
    '/api/auth/reset-password',
    asyncRoute(async (req, res) => {
      const token = req.body?.code;
      const email = text(req.body?.email, 'Email', 254, true).toLowerCase();
      const password = req.body?.password;
      if (typeof token !== 'string' || !/^\d{6}$/.test(token))
        fail('Enter the six-digit code from your email.');
      if (!validNewPassword(password)) fail(passwordRequirements);
      const salt = randomBytes(16).toString('hex');
      const hash = (await scrypt(password, salt, 64)).toString('hex');
      const attempt = await User.findOneAndUpdate(
        {
          email,
          resetExpiresAt: { $gt: new Date() },
          resetAttempts: { $lt: 5 },
        },
        { $inc: { resetAttempts: 1 } },
        { returnDocument: 'before' },
      ).select('+resetTokenHash');
      if (!attempt || attempt.resetTokenHash !== tokenHash(`${email}:${token}`))
        fail('This code is invalid or expired. Request a new code.');
      const user = await User.findOneAndUpdate(
        { _id: attempt._id, resetTokenHash: attempt.resetTokenHash },
        {
          $set: { passwordHash: `${salt}:${hash}` },
          $unset: { resetTokenHash: '', resetExpiresAt: '' },
        },
      );
      if (!user) fail('This code has already been used. Request a new code.');
      await Session.deleteMany({ user: user._id });
      res.clearCookie(COOKIE, {
        httpOnly: true,
        sameSite: 'strict',
        secure: production,
        path: '/',
      });
      res.json({ message: 'Password updated. Log in with your new password.' });
    }),
  );
  app.post(
    '/api/auth/register',
    asyncRoute(async (req, res) => {
      const body = req.body || {};
      const firstName = text(body.firstName, 'First name', 60, true);
      const lastName = text(body.lastName, 'Last name', 60, true);
      const email = text(body.email, 'Email', 254, true).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        fail('Enter a valid email address.');
      const username = text(body.username, 'Username', 30, true).toLowerCase();
      if (!/^[a-z0-9_]{3,30}$/.test(username))
        fail('Username must be 3–30 letters, numbers, or underscores.');
      const password = body.password;
      if (!validNewPassword(password)) fail(passwordRequirements);
      const salt = randomBytes(16).toString('hex');
      const hash = (await scrypt(password, salt, 64)).toString('hex');
      const user = await User.create({
        firstName,
        lastName,
        email,
        username,
        passwordHash: `${salt}:${hash}`,
      });
      await openSession(user, req, res);
      res.status(201).json({ user: safeUser(user) });
    }),
  );
  app.post(
    '/api/auth/login',
    asyncRoute(async (req, res) => {
      const identity = text(
        req.body?.identity,
        'Email or username',
        254,
        true,
      ).toLowerCase();
      const password = req.body?.password;
      if (typeof password !== 'string' || password.length > 128 || !password)
        fail('Enter your password.');
      const user = await User.findOne({
        $or: [{ email: identity }, { username: identity }],
      }).select('+passwordHash');
      const [salt, stored] = user
        ? user.passwordHash.split(':')
        : ['00000000000000000000000000000000', '00'.repeat(64)];
      const actual = await scrypt(password, salt, 64);
      if (!user || !timingSafeEqual(actual, Buffer.from(stored, 'hex')))
        fail('The email, username, or password is incorrect.', 401);
      await openSession(user, req, res);
      res.json({ user: safeUser(user) });
    }),
  );
  app.get('/api/auth/me', requireUser, (req, res) =>
    res.json({ user: safeUser(req.user), temporaryDatabase }),
  );
  app.post(
    '/api/auth/logout',
    asyncRoute(async (req, res) => {
      if (typeof req.cookies[COOKIE] === 'string')
        await Session.deleteOne({ tokenHash: tokenHash(req.cookies[COOKIE]) });
      res.clearCookie(COOKIE, {
        httpOnly: true,
        sameSite: 'strict',
        secure: production,
        path: '/',
      });
      res.status(204).end();
    }),
  );
  app.get(
    '/api/dogs',
    requireUser,
    asyncRoute(async (req, res) =>
      res.json({
        dogs: await Dog.find({ owner: req.user._id }).sort({ createdAt: 1 }),
      }),
    ),
  );
  app.post(
    '/api/dogs',
    requireUser,
    asyncRoute(async (req, res) => {
      const dog = await Dog.create({
        ...dogInput(req.body || {}, req.get('X-Pawfolio-Timezone')),
        owner: req.user._id,
      });
      res.status(201).json({ dog });
    }),
  );
  app.put(
    '/api/dogs/:dogId',
    requireUser,
    ownDog,
    asyncRoute(async (req, res) => {
      Object.assign(
        req.dog,
        dogInput(req.body || {}, req.get('X-Pawfolio-Timezone')),
      );
      await req.dog.save();
      res.json({ dog: req.dog });
    }),
  );

  app.delete(
    '/api/dogs/:dogId/emergency',
    requireUser,
    ownDog,
    asyncRoute(async (req, res) => {
      await EmergencyProfile.deleteOne({ dog: req.dog._id });
      res.status(204).end();
    }),
  );
  app.delete(
    '/api/dogs/:dogId',
    requireUser,
    ownDog,
    asyncRoute(async (req, res) => {
      for (const Model of [
        Vaccination,
        Reminder,
        MedicalRecord,
        EmergencyProfile,
      ])
        await Model.deleteMany({ dog: req.dog._id });
      await Dog.deleteOne({ _id: req.dog._id, owner: req.user._id });
      res.status(204).end();
    }),
  );
  app.get(
    '/api/dogs/:dogId/dashboard',
    requireUser,
    ownDog,
    asyncRoute(async (req, res) => {
      const [vaccinations, reminders] = await Promise.all([
        Vaccination.find({ dog: req.dog._id }).sort({ nextDueDate: 1 }),
        Reminder.find({ dog: req.dog._id }).sort({ scheduledAt: 1 }),
      ]);
      res.json({ dog: req.dog, vaccinations, reminders });
    }),
  );
  for (const method of ['post', 'put'])
    app[method](
      method === 'post'
        ? '/api/dogs/:dogId/vaccinations'
        : '/api/dogs/:dogId/vaccinations/:recordId',
      requireUser,
      ownDog,
      asyncRoute(async (req, res) => {
        const body = req.body || {};
        let existing;
        if (method === 'put') {
          if (!/^[a-f\d]{24}$/i.test(req.params.recordId))
            fail('Record not found.', 404);
          existing = await Vaccination.findOne({
            _id: req.params.recordId,
            dog: req.dog._id,
          });
          if (!existing) fail('Record not found.', 404);
        }
        const dateAdministered = date(
          body.dateAdministered,
          'Vaccination date',
        );
        const nextDueDate = date(body.nextDueDate, 'Next due date');
        if (!dateAdministered && !nextDueDate)
          fail('Enter a date administered or a next due date.');
        if (
          dateAdministered &&
          (body.dateAdministered.length === 10
            ? futureDate(body.dateAdministered, req.get('X-Pawfolio-Timezone'))
            : dateAdministered > new Date())
        )
          fail('Vaccination date cannot be in the future.');
        if (dateAdministered && nextDueDate && nextDueDate < dateAdministered)
          fail('Next due date must be on or after the vaccination date.');
        const values = {
          ...(body.photo !== undefined
            ? { photo: photoInput(body.photo) }
            : {}),
          dog: req.dog._id,
          name: text(body.name, 'Vaccine name', 100, true),
          dateAdministered,
          nextDueDate: nextDueDate || null,
          clinic: text(body.clinic, 'Clinic', 100),
          veterinarian: text(body.veterinarian, 'Veterinarian', 100),
        };
        const vaccination = existing
          ? await Object.assign(existing, values).save()
          : await Vaccination.create(values);
        res.status(method === 'post' ? 201 : 200).json({ vaccination });
      }),
    );
  for (const method of ['post', 'put'])
    app[method](
      method === 'post'
        ? '/api/dogs/:dogId/reminders'
        : '/api/dogs/:dogId/reminders/:recordId',
      requireUser,
      ownDog,
      asyncRoute(async (req, res) => {
        const body = req.body || {};
        let existing;
        if (method === 'put') {
          if (!/^[a-f\d]{24}$/i.test(req.params.recordId))
            fail('Record not found.', 404);
          existing = await Reminder.findOne({
            _id: req.params.recordId,
            dog: req.dog._id,
          });
          if (!existing) fail('Record not found.', 404);
        }
        const type = body.type || 'Other';
        if (!['Vet visit', 'Grooming', 'Medication', 'Other'].includes(type))
          fail('Choose a valid reminder type.');
        const rawAdvance = body.remindBeforeMinutes;
        if (
          rawAdvance !== undefined &&
          !(
            typeof rawAdvance === 'number' ||
            (typeof rawAdvance === 'string' && /^\d+$/.test(rawAdvance))
          )
        )
          fail('Choose a valid advance reminder time.');
        const remindBeforeMinutes =
          rawAdvance === undefined
            ? (existing?.remindBeforeMinutes ?? defaultAdvance(type))
            : Number(rawAdvance);
        if (
          !advanceOptions.some(([minutes]) => minutes === remindBeforeMinutes)
        )
          fail('Choose a valid advance reminder time.');
        const values = {
          dog: req.dog._id,
          title: text(body.title, 'Reminder title', 120, true),
          scheduledAt: date(body.scheduledAt, 'Reminder date and time', true),
          remindBeforeMinutes,
          type,
        };
        const reminder = existing
          ? await Object.assign(existing, values).save()
          : await Reminder.create(values);
        res.status(method === 'post' ? 201 : 200).json({ reminder });
      }),
    );
  app.patch(
    '/api/dogs/:dogId/reminders/:reminderId',
    requireUser,
    ownDog,
    asyncRoute(async (req, res) => {
      if (!/^[a-f\d]{24}$/i.test(req.params.reminderId))
        fail('Reminder not found.', 404);
      if (typeof req.body?.completed !== 'boolean')
        fail('Completion status must be true or false.');
      const reminder = await Reminder.findOneAndUpdate(
        { _id: req.params.reminderId, dog: req.dog._id },
        { completed: req.body.completed },
        { returnDocument: 'after' },
      );
      if (!reminder) fail('Reminder not found.', 404);
      res.json({ reminder });
    }),
  );

  app.get(
    '/api/dogs/:dogId/medical',
    requireUser,
    ownDog,
    asyncRoute(async (req, res) => {
      res.json({
        records: await MedicalRecord.find({ dog: req.dog._id }).sort({
          visitedAt: -1,
          createdAt: -1,
        }),
      });
    }),
  );
  for (const [resource, Model] of [
    ['vaccinations', Vaccination],
    ['medical', MedicalRecord],
    ['reminders', Reminder],
  ]) {
    app.delete(
      `/api/dogs/:dogId/${resource}/:recordId`,
      requireUser,
      ownDog,
      asyncRoute(async (req, res) => {
        if (!/^[a-f\d]{24}$/i.test(req.params.recordId))
          fail('Record not found.', 404);
        const record = await Model.findOneAndDelete({
          _id: req.params.recordId,
          dog: req.dog._id,
        });
        if (!record) fail('Record not found.', 404);
        res.status(204).end();
      }),
    );
  }
  for (const method of ['post', 'put'])
    app[method](
      method === 'post'
        ? '/api/dogs/:dogId/medical'
        : '/api/dogs/:dogId/medical/:recordId',
      requireUser,
      ownDog,
      asyncRoute(async (req, res) => {
        const body = req.body || {};
        let existing;
        if (method === 'put') {
          if (!/^[a-f\d]{24}$/i.test(req.params.recordId))
            fail('Record not found.', 404);
          existing = await MedicalRecord.findOne({
            _id: req.params.recordId,
            dog: req.dog._id,
          });
          if (!existing) fail('Record not found.', 404);
        }
        const category = body.category;
        if (
          !['Checkup', 'Treatment', 'Surgery', 'Lab result', 'Other'].includes(
            category,
          )
        )
          fail('Choose a valid record category.');
        const visitedAt = date(body.visitedAt, 'Visit date', true);
        if (
          body.visitedAt.length === 10
            ? futureDate(body.visitedAt, req.get('X-Pawfolio-Timezone'))
            : visitedAt > new Date()
        )
          fail('Visit date cannot be in the future.');
        const values = {
          ...(body.photo !== undefined
            ? { photo: photoInput(body.photo) }
            : {}),
          dog: req.dog._id,
          title: text(body.title, 'Record title', 120, true),
          category,
          visitedAt,
          veterinarian: text(body.veterinarian, 'Veterinarian', 100),
          clinic: text(body.clinic, 'Clinic', 100),
          notes: text(body.notes, 'Notes', 3000),
        };
        const record = existing
          ? await Object.assign(existing, values).save()
          : await MedicalRecord.create(values);
        res.status(method === 'post' ? 201 : 200).json({ record });
      }),
    );
  app.get(
    '/api/dogs/:dogId/emergency',
    requireUser,
    ownDog,
    asyncRoute(async (req, res) => {
      res.json({
        profile: await EmergencyProfile.findOne({ dog: req.dog._id }),
      });
    }),
  );
  app.put(
    '/api/dogs/:dogId/emergency',
    requireUser,
    ownDog,
    asyncRoute(async (req, res) => {
      const body = req.body || {};
      const values = {};
      for (const [field, max] of Object.entries({
        contactName: 100,
        contactPhone: 40,
        clinic: 100,
        clinicPhone: 40,
        clinicAddress: 300,
        allergies: 1000,
        medications: 1000,
        conditions: 1000,
        instructions: 2000,
      }))
        values[field] = text(body[field], field, max);
      const profile = await EmergencyProfile.findOneAndUpdate(
        { dog: req.dog._id },
        { $set: values },
        { upsert: true, returnDocument: 'after', runValidators: true },
      );
      res.json({ profile });
    }),
  );
  app.use('/api', (req, res) =>
    res.status(404).json({ message: 'This endpoint was not found.' }),
  );
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.code === 11000)
      return res
        .status(409)
        .json({ message: 'That email or username is already registered.' });
    if (error instanceof SyntaxError && error.status === 400)
      return res.status(400).json({ message: 'Please send valid form data.' });
    if (error.name === 'ValidationError' || error.name === 'CastError')
      return res
        .status(400)
        .json({ message: 'Check the information you entered and try again.' });
    if (!error.status) console.error('Request failed:', error.message);
    res.status(error.status || 500).json({
      message: error.status
        ? error.message
        : 'Something went wrong. Please try again.',
    });
  });
  return app;
}
