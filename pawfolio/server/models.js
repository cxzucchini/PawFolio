import mongoose from 'mongoose';
import { advanceOptions, defaultAdvance } from '../shared/reminderTiming.js';
const { Schema } = mongoose;

const userSchema = new Schema(
  {
    firstName: { type: String, required: true, maxlength: 60 },
    lastName: { type: String, required: true, maxlength: 60 },
    email: { type: String, required: true, unique: true },
    username: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true, select: false },
    resetTokenHash: { type: String, select: false },
    resetExpiresAt: { type: Date, select: false },
    resetAttempts: { type: Number, default: 0, select: false },
    dateOfBirth: Date,
    address: { type: String, maxlength: 300 },
    phoneNumber: { type: String, maxlength: 30 },
  },
  { timestamps: true },
);

const sessionSchema = new Schema({
  tokenHash: { type: String, required: true, unique: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
});

const dogSchema = new Schema(
  {
    photo: { type: String, maxlength: 700000, default: '' },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: { type: String, required: true, maxlength: 60 },
    species: { type: String, enum: ['Dog'], default: 'Dog', immutable: true },
    breed: { type: String, required: true, maxlength: 100 },
    dateOfBirth: { type: Date, required: true },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Unknown'],
      default: 'Unknown',
    },
    weight: { type: Number, min: 0.1, max: 150 },
    microchip: { type: String, maxlength: 30, default: '' },
    veterinarian: { type: String, maxlength: 100, default: '' },
  },
  { timestamps: true },
);

const vaccinationSchema = new Schema(
  {
    photo: { type: String, maxlength: 700000, default: '' },
    dog: {
      type: Schema.Types.ObjectId,
      ref: 'Dog',
      required: true,
      index: true,
    },
    name: { type: String, required: true, maxlength: 100 },
    dateAdministered: Date,
    nextDueDate: { type: Date, default: null },
    clinic: { type: String, maxlength: 100, default: '' },
    veterinarian: { type: String, maxlength: 100, default: '' },
  },
  { timestamps: true },
);

const reminderSchema = new Schema(
  {
    dog: {
      type: Schema.Types.ObjectId,
      ref: 'Dog',
      required: true,
      index: true,
    },
    title: { type: String, required: true, maxlength: 120 },
    type: {
      type: String,
      enum: ['Vet visit', 'Grooming', 'Medication', 'Other'],
      default: 'Other',
    },
    scheduledAt: { type: Date, required: true },
    remindBeforeMinutes: {
      type: Number,
      enum: advanceOptions.map(([minutes]) => minutes),
      default: function () {
        return defaultAdvance(this.type);
      },
    },
    completed: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const User = mongoose.model('User', userSchema);
export const Session = mongoose.model('Session', sessionSchema);
export const Dog = mongoose.model('Dog', dogSchema);
export const Vaccination = mongoose.model('Vaccination', vaccinationSchema);
export const Reminder = mongoose.model('Reminder', reminderSchema);
export const MedicalRecord = mongoose.model(
  'MedicalRecord',
  new Schema(
    {
      photo: { type: String, maxlength: 700000, default: '' },
      dog: {
        type: Schema.Types.ObjectId,
        ref: 'Dog',
        required: true,
        index: true,
      },
      title: { type: String, required: true, maxlength: 120 },
      category: {
        type: String,
        enum: ['Checkup', 'Treatment', 'Surgery', 'Lab result', 'Other'],
        required: true,
      },
      visitedAt: { type: Date, required: true },
      veterinarian: { type: String, maxlength: 100 },
      clinic: { type: String, maxlength: 100 },
      notes: { type: String, maxlength: 3000 },
    },
    { timestamps: true },
  ),
);
export const EmergencyProfile = mongoose.model(
  'EmergencyProfile',
  new Schema(
    {
      dog: {
        type: Schema.Types.ObjectId,
        ref: 'Dog',
        required: true,
        unique: true,
      },
      contactName: { type: String, maxlength: 100 },
      contactPhone: { type: String, maxlength: 40 },
      clinic: { type: String, maxlength: 100 },
      clinicPhone: { type: String, maxlength: 40 },
      clinicAddress: { type: String, maxlength: 300 },
      allergies: { type: String, maxlength: 1000 },
      medications: { type: String, maxlength: 1000 },
      conditions: { type: String, maxlength: 1000 },
      instructions: { type: String, maxlength: 2000 },
    },
    { timestamps: true },
  ),
);
