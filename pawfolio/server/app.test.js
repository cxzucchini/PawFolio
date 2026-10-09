import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from './app.js';
import {
  User,
  Dog,
  Vaccination,
  Reminder,
  MedicalRecord,
  EmergencyProfile,
} from './models.js';
import { photoInput } from './photos.js';
import { calendarDay, futureDate } from '../shared/calendarDate.js';

test('date-only validation uses local calendar days across UTC boundaries', () => {
  const now = new Date('2026-10-08T16:30:00Z');
  assert.equal(calendarDay(now, 'Asia/Manila'), '2026-10-09');
  assert.equal(futureDate('2026-10-09', 'Asia/Manila', now), false);
  assert.equal(futureDate('2026-10-10', 'Asia/Manila', now), true);
  assert.equal(futureDate('2026-10-09', 'America/Los_Angeles', now), true);
  assert.equal(calendarDay(now, 'Invalid/Zone'), '2026-10-08');
  assert.equal(calendarDay(now, 'Pacific/Kiritimati'), '2026-10-09');
});
let database, server, base;
const contactMessages = [];
let contactFailure = false;
before(
  async () => {
    database = await MongoMemoryServer.create();
    await mongoose.connect(database.getUri());
    await Promise.all(
      Object.values(mongoose.models).map((model) => model.init()),
    );
    server = createApp({
      temporaryDatabase: true,
      authRateLimit: false,
      contactMailer: async (message) => {
        if (contactFailure) throw new Error('Mail unavailable');
        contactMessages.push(message);
      },
    }).listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}/api`;
  },
  { timeout: 180000 },
);
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  await database?.stop();
});
async function request(path, { cookie, method = 'GET', body, origin } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(origin ? { Origin: origin } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    status: response.status,
    data: response.status === 204 ? null : await response.json(),
    cookie: response.headers.get('set-cookie'),
  };
}
const account = {
  firstName: 'Alex',
  lastName: 'Parent',
  email: 'alex@example.com',
  username: 'alex_parent',
  password: 'A-long-test-password-123',
};
const testPhoto =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
test('photo validation rejects unsafe and oversized uploads', () => {
  assert.equal(photoInput(testPhoto), testPhoto);
  for (const value of [
    'https://example.com/image.jpg',
    'data:image/svg+xml;base64,PHN2Zz4=',
    'data:image/jpeg;base64,aGVsbG8=',
    'data:image/png;base64,' + 'A'.repeat(700001),
  ])
    assert.throws(() => photoInput(value));
});
test('medical history and reminder deletion requires ownership', async () => {
  const registered = await request('/auth/register', {
    method: 'POST',
    body: { ...account, email: 'delete@example.com', username: 'delete_owner' },
  });
  const cookie = registered.cookie.split(';')[0];
  const other = await request('/auth/register', {
    method: 'POST',
    body: {
      ...account,
      email: 'delete-other@example.com',
      username: 'delete_other',
    },
  });
  const otherCookie = other.cookie.split(';')[0];
  const dog = await request('/dogs', {
    cookie,
    method: 'POST',
    body: {
      name: 'Delete test',
      breed: 'Retriever',
      dateOfBirth: '2022-01-01',
    },
  });
  const id = dog.data.dog._id;
  for (const [resource, body, key] of [
    [
      'medical',
      { title: 'Checkup', category: 'Checkup', visitedAt: '2024-01-01' },
      'record',
    ],
    [
      'reminders',
      { title: 'Appointment', type: 'Vet visit', scheduledAt: '2030-01-01' },
      'reminder',
    ],
  ]) {
    const created = await request(`/dogs/${id}/${resource}`, {
      cookie,
      method: 'POST',
      body,
    });
    const path = `/dogs/${id}/${resource}/${created.data[key]._id}`;
    assert.equal((await request(path, { method: 'DELETE' })).status, 401);
    assert.equal(
      (await request(path, { cookie: otherCookie, method: 'DELETE' })).status,
      404,
    );
    assert.equal(
      (await request(path, { cookie, method: 'DELETE' })).status,
      204,
    );
    assert.equal(
      (await request(path, { cookie, method: 'DELETE' })).status,
      404,
    );
  }
  assert.deepEqual(
    (await request(`/dogs/${id}/medical`, { cookie })).data.records,
    [],
  );
  assert.deepEqual(
    (await request(`/dogs/${id}/dashboard`, { cookie })).data.reminders,
    [],
  );
});
test('password reset codes are private, single-use and invalidate sessions', async () => {
  const email = 'reset-test@example.com';
  const registered = await request('/auth/register', {
    method: 'POST',
    body: { ...account, email, username: 'reset_test' },
  });
  const cookie = registered.cookie.split(';')[0];
  const delivered = [];
  const resetServer = createApp({
    authRateLimit: false,
    resetMailer: async (address, code) => delivered.push({ address, code }),
  }).listen(0, '127.0.0.1');
  await new Promise((resolve) => resetServer.once('listening', resolve));
  const resetBase = `http://127.0.0.1:${resetServer.address().port}/api/auth`;
  const post = async (path, body) => {
    const r = await fetch(`${resetBase}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: r.status, data: await r.json() };
  };
  try {
    const known = await post('forgot-password', { email });
    const unknown = await post('forgot-password', {
      email: 'missing@example.com',
    });
    assert.deepEqual(known, unknown);
    assert.equal(delivered.length, 1);
    assert.match(delivered[0].code, /^\d{6}$/);
    const password = 'New-long-password-456';
    for (const weak of [
      'lowercase-only-123',
      'UppercaseWithoutNumber!',
      'Uppercase12345',
      'Uppercase123  ',
    ]) {
      assert.equal(
        (
          await post('reset-password', {
            email,
            code: delivered[0].code,
            password: weak,
          })
        ).status,
        400,
      );
    }
    assert.equal(
      (
        await post('reset-password', {
          email,
          code: delivered[0].code,
          password,
        })
      ).status,
      200,
    );
    assert.equal((await request('/auth/me', { cookie })).status, 401);
    assert.equal(
      (
        await post('reset-password', {
          email,
          code: delivered[0].code,
          password,
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await request('/auth/login', {
          method: 'POST',
          body: { identity: email, password },
        })
      ).status,
      200,
    );
    await post('forgot-password', { email });
    const wrongCode = delivered[1].code === '000000' ? '111111' : '000000';
    for (let index = 0; index < 5; index++)
      assert.equal(
        (await post('reset-password', { email, code: wrongCode, password }))
          .status,
        400,
      );
    assert.equal(
      (
        await post('reset-password', {
          email,
          code: delivered[1].code,
          password,
        })
      ).status,
      400,
    );
    await post('forgot-password', { email });
    await User.updateOne({ email }, { $set: { resetExpiresAt: new Date(0) } });
    assert.equal(
      (
        await post('reset-password', {
          email,
          code: delivered[2].code,
          password,
        })
      ).status,
      400,
    );
  } finally {
    await new Promise((resolve) => resetServer.close(resolve));
  }
});
test('preview endpoint is removed and old preview sessions are rejected', async () => {
  assert.equal(
    (await request('/auth/dev-session', { method: 'POST' })).status,
    404,
  );
  for (const [index, email] of [
    'preview@pawfolio.invalid',
    'public-preview@pawfolio.invalid',
  ].entries()) {
    const registered = await request('/auth/register', {
      method: 'POST',
      body: { ...account, email, username: `retired_preview_${index}` },
    });
    assert.equal(registered.status, 201);
    const cookie = registered.cookie.split(';')[0];
    assert.equal((await request('/auth/me', { cookie })).status, 401);
    assert.equal((await request('/dogs', { cookie })).status, 401);
  }
});
test('registration, session restoration, dog care data, ownership, and logout', async () => {
  assert.equal((await request('/dogs')).status, 401);
  const registered = await request('/auth/register', {
    method: 'POST',
    body: account,
  });
  assert.equal(registered.status, 201);
  assert.equal(registered.data.user.firstName, 'Alex');
  assert.equal(registered.data.user.passwordHash, undefined);
  assert.match(registered.cookie, /HttpOnly/);
  assert.match(registered.cookie, /SameSite=Strict/);
  const cookie = registered.cookie.split(';')[0];
  assert.equal((await request('/auth/me', { cookie })).status, 200);
  assert.deepEqual((await request('/dogs', { cookie })).data.dogs, []);
  const stored = await User.findOne({ email: account.email }).select(
    '+passwordHash',
  );
  assert.notEqual(stored.passwordHash, account.password);
  assert.match(stored.passwordHash, /^[a-f0-9]{32}:[a-f0-9]{128}$/);
  assert.equal(
    (await request('/auth/register', { method: 'POST', body: account })).status,
    409,
  );
  assert.equal(
    (
      await request('/auth/login', {
        method: 'POST',
        body: { identity: account.email, password: 'incorrect-password' },
      })
    ).status,
    401,
  );
  const body = {
    name: 'Buster',
    breed: 'Golden Retriever',
    dateOfBirth: '2023-03-10',
    gender: 'Male',
    weight: '28.5',
    microchip: '123456789',
    veterinarian: 'Dr. Sarah',
    species: 'Cat',
    owner: '000000000000000000000000',
  };
  const created = await request('/dogs', { method: 'POST', cookie, body });
  assert.equal(created.status, 201);
  const id = created.data.dog._id;
  const photoBody = { ...body, photo: testPhoto };
  assert.equal(
    (await request(`/dogs/${id}`, { method: 'PUT', cookie, body: photoBody }))
      .data.dog.photo,
    testPhoto,
  );
  assert.equal(
    (await request(`/dogs/${id}/dashboard`, { cookie })).data.dog.photo,
    testPhoto,
  );
  assert.equal(
    (
      await request(`/dogs/${id}`, {
        method: 'PUT',
        cookie,
        body: { ...body, photo: '' },
      })
    ).data.dog.photo,
    '',
  );
  assert.equal(created.data.dog.species, 'Dog');
  assert.equal(created.data.dog.owner, registered.data.user.id);
  assert.equal(
    (
      await request('/dogs', {
        method: 'POST',
        cookie,
        body: { ...body, weight: -5 },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request('/dogs', {
        method: 'POST',
        cookie,
        body: { ...body, dateOfBirth: '2023-02-30' },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(`/dogs/${id}`, {
        method: 'PUT',
        cookie,
        body: { ...body, weight: '29' },
      })
    ).data.dog.weight,
    29,
  );
  assert.equal(
    (
      await request(`/dogs/${id}/vaccinations`, {
        method: 'POST',
        cookie,
        body: {
          name: 'Rabies',
          dateAdministered: '2024-01-01',
          nextDueDate: '2025-01-01',
        },
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await request(`/dogs/${id}/vaccinations`, {
        method: 'POST',
        cookie,
        body: {
          name: 'Invalid',
          dateAdministered: '2024-01-01',
          nextDueDate: '2023-01-01',
        },
      })
    ).status,
    400,
  );
  const reminder = await request(`/dogs/${id}/reminders`, {
    method: 'POST',
    cookie,
    body: {
      title: 'Annual checkup',
      type: 'Vet visit',
      scheduledAt: '2030-01-01T08:00:00.000Z',
    },
  });
  assert.equal(reminder.status, 201);
  assert.equal(
    (
      await request(`/dogs/${id}/reminders/${reminder.data.reminder._id}`, {
        method: 'PATCH',
        cookie,
        body: { completed: true },
      })
    ).data.reminder.completed,
    true,
  );
  const dashboard = await request(`/dogs/${id}/dashboard`, { cookie });
  assert.equal(dashboard.data.vaccinations.length, 1);
  assert.equal(dashboard.data.reminders[0].completed, true);
  const second = await request('/auth/register', {
    method: 'POST',
    body: { ...account, email: 'other@example.com', username: 'other_parent' },
  });
  const otherCookie = second.cookie.split(';')[0];
  const medical = await request(`/dogs/${id}/medical`, {
    method: 'POST',
    cookie,
    body: {
      title: 'Wellness visit',
      category: 'Checkup',
      visitedAt: '2024-05-01',
      notes: 'Care notes',
      dog: '000000000000000000000000',
    },
  });
  assert.equal(medical.status, 201);
  assert.equal(medical.data.record.dog, id);
  assert.equal(
    (await request(`/dogs/${id}/medical`, { cookie })).data.records[0].notes,
    'Care notes',
  );
  assert.equal(
    (
      await request(`/dogs/${id}/medical`, {
        method: 'POST',
        cookie,
        body: {
          title: 'Invalid',
          category: 'Unknown',
          visitedAt: '2024-05-01',
        },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(`/dogs/${id}/medical`, {
        method: 'POST',
        cookie,
        body: { title: 'Future', category: 'Checkup', visitedAt: '2099-01-01' },
      })
    ).status,
    400,
  );
  assert.equal(
    (await request(`/dogs/${id}/emergency`, { cookie })).data.profile,
    null,
  );
  const emergency = await request(`/dogs/${id}/emergency`, {
    method: 'PUT',
    cookie,
    body: {
      contactName: 'Caregiver',
      contactPhone: '+63 900 000 0000',
      allergies: 'Not confirmed',
      dog: '000000000000000000000000',
    },
  });
  assert.equal(emergency.status, 200);
  assert.equal(emergency.data.profile.dog, id);
  assert.equal(
    (await request(`/dogs/${id}/emergency`, { cookie })).data.profile
      .contactName,
    'Caregiver',
  );
  const updatedEmergency = await request(`/dogs/${id}/emergency`, {
    method: 'PUT',
    cookie,
    body: { contactName: 'Updated caregiver' },
  });
  assert.equal(updatedEmergency.data.profile._id, emergency.data.profile._id);
  assert.equal(updatedEmergency.data.profile.contactPhone, '');
  assert.equal(
    (
      await request(`/dogs/${id}/emergency`, {
        method: 'PUT',
        cookie,
        body: { allergies: 'x'.repeat(1001) },
      })
    ).status,
    400,
  );
  for (const resource of ['medical', 'emergency']) {
    assert.equal((await request(`/dogs/${id}/${resource}`)).status, 401);
    assert.equal(
      (await request(`/dogs/${id}/${resource}`, { cookie: otherCookie }))
        .status,
      404,
    );
    assert.equal(
      (
        await request(`/dogs/${id}/${resource}`, {
          method: resource === 'medical' ? 'POST' : 'PUT',
          cookie: otherCookie,
          body: {},
        })
      ).status,
      404,
    );
  }
  assert.equal(
    (await request(`/dogs/${id}/dashboard`, { cookie: otherCookie })).status,
    404,
  );
  assert.equal(
    (await request(`/dogs/${id}`, { method: 'PUT', cookie: otherCookie, body }))
      .status,
    404,
  );
  assert.equal(
    (
      await request(`/dogs/${id}/vaccinations`, {
        method: 'POST',
        cookie: otherCookie,
        body: { name: 'Rabies', nextDueDate: '2030-01-01' },
      })
    ).status,
    404,
  );
  assert.equal(
    (await request('/dogs/not-an-id/dashboard', { cookie })).status,
    404,
  );
  assert.equal(
    (
      await request('/dogs', {
        method: 'POST',
        cookie,
        body,
        origin: 'https://untrusted.example',
      })
    ).status,
    403,
  );
  assert.equal(
    (await request('/auth/logout', { method: 'POST', cookie })).status,
    204,
  );
  assert.equal((await request('/auth/me', { cookie })).status, 401);
  const loggedIn = await request('/auth/login', {
    method: 'POST',
    body: { identity: account.username, password: account.password },
  });
  assert.equal(loggedIn.status, 200);
  assert.equal(
    (await request('/dogs', { cookie: loggedIn.cookie.split(';')[0] })).data
      .dogs.length,
    1,
  );
});
test('registration validates identity and password inputs', async () => {
  for (const password of [
    'lowercase-only-123',
    'UppercaseWithoutNumber!',
    'Uppercase12345',
    'Uppercase123  ',
  ]) {
    assert.equal(
      (
        await request('/auth/register', {
          method: 'POST',
          body: { ...account, password },
        })
      ).status,
      400,
    );
  }
  for (const fields of [
    { password: 'short' },
    { email: 'invalid' },
    { username: 'x' },
    { firstName: '' },
    { email: { $ne: null } },
  ]) {
    assert.equal(
      (
        await request('/auth/register', {
          method: 'POST',
          body: { ...account, ...fields },
        })
      ).status,
      400,
    );
  }
});
test('care records can be edited safely and dog deletion clears dependent records', async () => {
  const owner = await request('/auth/register', {
    method: 'POST',
    body: {
      ...account,
      email: 'edit-owner@example.com',
      username: 'edit_owner',
    },
  });
  const stranger = await request('/auth/register', {
    method: 'POST',
    body: {
      ...account,
      email: 'edit-other@example.com',
      username: 'edit_other',
    },
  });
  const cookie = owner.cookie.split(';')[0],
    otherCookie = stranger.cookie.split(';')[0];
  const createDog = async (name) =>
    (
      await request('/dogs', {
        cookie,
        method: 'POST',
        body: { name, breed: 'Retriever', dateOfBirth: '2022-01-01' },
      })
    ).data.dog._id;
  const id = await createDog('Editable'),
    otherId = await createDog('Other');
  for (const [resource, key, body, update] of [
    [
      'vaccinations',
      'vaccination',
      {
        name: 'Rabies',
        dateAdministered: '2024-01-01',
        nextDueDate: '2030-01-01',
        photo: testPhoto,
      },
      { name: 'Updated vaccine' },
    ],
    [
      'medical',
      'record',
      {
        title: 'Checkup',
        category: 'Checkup',
        visitedAt: '2024-01-01',
        photo: testPhoto,
      },
      { title: 'Updated visit' },
    ],
    [
      'reminders',
      'reminder',
      {
        title: 'Checkup',
        type: 'Vet visit',
        scheduledAt: '2030-01-01T09:00:00Z',
      },
      { title: 'Updated reminder' },
    ],
  ]) {
    const created = await request('/dogs/' + id + '/' + resource, {
      cookie,
      method: 'POST',
      body,
    });
    assert.equal(created.status, 201);
    const recordId = created.data[key]._id;
    const path = '/dogs/' + id + '/' + resource + '/' + recordId;
    if (resource === 'reminders')
      await request(path, {
        cookie,
        method: 'PATCH',
        body: { completed: true },
      });
    assert.equal(
      (
        await request(path, {
          cookie: otherCookie,
          method: 'PUT',
          body: { ...body, ...update },
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await request('/dogs/' + otherId + '/' + resource + '/' + recordId, {
          cookie,
          method: 'PUT',
          body: { ...body, ...update },
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await request(path, {
          cookie,
          method: 'PUT',
          body: {
            ...body,
            nextDueDate: 'invalid',
            visitedAt: 'invalid',
            scheduledAt: 'invalid',
          },
        })
      ).status,
      400,
    );
    const { photo, ...withoutPhoto } = body;
    const edited = await request(path, {
      cookie,
      method: 'PUT',
      body: { ...withoutPhoto, ...update },
    });
    assert.equal(edited.status, 200);
    for (const [field, value] of Object.entries(update))
      assert.equal(edited.data[key][field], value);
    if (photo) assert.equal(edited.data[key].photo, photo);
    if (resource === 'reminders')
      assert.equal(edited.data[key].completed, true);
    if (resource === 'vaccinations') {
      assert.equal(
        (await request(path, { cookie: otherCookie, method: 'DELETE' })).status,
        404,
      );
      assert.equal(
        (await request(path, { cookie, method: 'DELETE' })).status,
        204,
      );
      assert.equal(
        (await request(path, { cookie, method: 'PUT', body })).status,
        404,
      );
      await request('/dogs/' + id + '/' + resource, {
        cookie,
        method: 'POST',
        body,
      });
    }
  }
  const vault = '/dogs/' + id + '/emergency';
  await request(vault, { cookie, method: 'PUT', body: { contactName: 'Jay' } });
  assert.equal(
    (await request(vault, { cookie: otherCookie, method: 'DELETE' })).status,
    404,
  );
  assert.equal(
    (await request(vault, { cookie, method: 'DELETE' })).status,
    204,
  );
  assert.equal((await request(vault, { cookie })).data.profile, null);
  await request(vault, { cookie, method: 'PUT', body: { contactName: 'Jay' } });
  assert.equal(
    (await request('/dogs/' + id, { cookie: otherCookie, method: 'DELETE' }))
      .status,
    404,
  );
  assert.equal(
    (await request('/dogs/' + id, { cookie, method: 'DELETE' })).status,
    204,
  );
  for (const Model of [Vaccination, Reminder, MedicalRecord, EmergencyProfile])
    assert.equal(await Model.countDocuments({ dog: id }), 0);
  assert.equal(await Dog.countDocuments({ _id: id }), 0);
  assert.equal(await Dog.countDocuments({ _id: otherId }), 1);
});

test('contact messages require login, validate input, use account identity, and limit submissions', async () => {
  const body = {
    topic: 'General question',
    subject: 'Account question',
    message: 'Please help with my dog profile.',
  };
  assert.equal(
    (await request('/contact', { method: 'POST', body })).status,
    401,
  );
  const registered = await request('/auth/register', {
    method: 'POST',
    body: {
      ...account,
      email: 'contact@example.com',
      username: 'contact_owner',
    },
  });
  const cookie = registered.cookie.split(';')[0];
  for (const invalid of [
    { ...body, topic: 'Spam' },
    { ...body, subject: 'Injected\r\nheader' },
    { ...body, message: 'Short' },
  ])
    assert.equal(
      (await request('/contact', { cookie, method: 'POST', body: invalid }))
        .status,
      400,
    );
  const sent = await request('/contact', {
    cookie,
    method: 'POST',
    body: { ...body, email: 'spoof@example.com', name: 'Spoofed' },
  });
  assert.equal(sent.status, 200);
  assert.deepEqual(contactMessages.at(-1), {
    ...body,
    name: 'Alex Parent',
    email: 'contact@example.com',
  });
  contactFailure = true;
  try {
    assert.equal(
      (await request('/contact', { cookie, method: 'POST', body })).status,
      503,
    );
  } finally {
    contactFailure = false;
  }
  assert.equal(
    (await request('/contact', { cookie, method: 'POST', body })).status,
    429,
  );
});

test('public contact accepts visitor details without login and rejects invalid email', async () => {
  const body = {
    name: 'Visitor',
    email: 'visitor@example.com',
    topic: 'Feedback',
    subject: 'An idea',
    message: 'I would like to share an idea.',
  };
  assert.equal(
    (
      await request('/contact/public', {
        method: 'POST',
        body: { ...body, email: 'invalid' },
      })
    ).status,
    400,
  );
  assert.equal(
    (await request('/contact/public', { method: 'POST', body })).status,
    200,
  );
  assert.deepEqual(contactMessages.at(-1), body);
});

test('grooming appointments are saved as reminders and feeding endpoint is removed', async () => {
  const registered = await request('/auth/register', {
    method: 'POST',
    body: { ...account, email: 'groom@example.com', username: 'groom_owner' },
  });
  const cookie = registered.cookie.split(';')[0];
  const created = await request('/dogs', {
    cookie,
    method: 'POST',
    body: { name: 'Scott', breed: 'Poodle', dateOfBirth: '2022-01-01' },
  });
  const id = created.data.dog._id;
  const appointment = await request('/dogs/' + id + '/reminders', {
    cookie,
    method: 'POST',
    body: {
      title: 'Bath and nail trim',
      type: 'Grooming',
      scheduledAt: '2030-01-01T10:00:00Z',
    },
  });
  assert.equal(appointment.status, 201);
  assert.equal(appointment.data.reminder.type, 'Grooming');
  assert.equal(
    (await request('/dogs/' + id + '/dashboard', { cookie })).data.reminders[0]
      .title,
    'Bath and nail trim',
  );
  assert.equal(
    (
      await request('/dogs/' + id + '/feeding', {
        cookie,
        method: 'PATCH',
        body: { meal: 0, fed: true, date: '2030-01-01' },
      })
    ).status,
    404,
  );
});
test('advance reminder defaults, saved choices, and invalid timing', async () => {
  const registered = await request('/auth/register', {
    method: 'POST',
    body: {
      ...account,
      email: 'advance@example.com',
      username: 'advance_owner',
    },
  });
  const cookie = registered.cookie.split(';')[0];
  const created = await request('/dogs', {
    cookie,
    method: 'POST',
    body: { name: 'Scott', breed: 'Poodle', dateOfBirth: '2022-01-01' },
  });
  const path = `/dogs/${created.data.dog._id}/reminders`;
  for (const [type, expected] of [
    ['Vet visit', 1440],
    ['Grooming', 1440],
    ['Medication', 30],
    ['Other', 0],
  ]) {
    const body = { title: 'Care', type, scheduledAt: '2030-01-01T10:00:00Z' };
    const saved = await request(path, { cookie, method: 'POST', body });
    assert.equal(saved.status, 201);
    assert.equal(saved.data.reminder.remindBeforeMinutes, expected);
    const edit = path + '/' + saved.data.reminder._id;
    assert.equal(
      (
        await request(edit, {
          cookie,
          method: 'PUT',
          body: { ...body, remindBeforeMinutes: '0' },
        })
      ).data.reminder.remindBeforeMinutes,
      0,
    );
    assert.equal(
      (await request(edit, { cookie, method: 'PUT', body })).data.reminder
        .remindBeforeMinutes,
      0,
    );
    for (const invalid of [-1, 20, null, true, 'abc'])
      assert.equal(
        (
          await request(edit, {
            cookie,
            method: 'PUT',
            body: { ...body, remindBeforeMinutes: invalid },
          })
        ).status,
        400,
      );
  }
});
test('vaccination history works without a next due date and can clear a saved date', async () => {
  const registered = await request('/auth/register', {
    method: 'POST',
    body: {
      ...account,
      email: 'vaxhistory@example.com',
      username: 'vaxhistory',
    },
  });
  const cookie = registered.cookie.split(';')[0];
  const dog = await request('/dogs', {
    cookie,
    method: 'POST',
    body: { name: 'Scott', breed: 'Poodle', dateOfBirth: '2022-01-01' },
  });
  const path = `/dogs/${dog.data.dog._id}/vaccinations`;
  const body = {
    name: 'Rabies',
    dateAdministered: '2024-01-01',
    clinic: 'Clinic',
    veterinarian: 'Dr Test',
    photo: testPhoto,
  };
  const saved = await request(path, { cookie, method: 'POST', body });
  assert.equal(saved.status, 201);
  assert.equal(saved.data.vaccination.nextDueDate, null);
  const recordPath = path + '/' + saved.data.vaccination._id;
  assert.equal(
    (
      await request(recordPath, {
        cookie,
        method: 'PUT',
        body: { ...body, nextDueDate: '2030-01-01' },
      })
    ).status,
    200,
  );
  const cleared = await request(recordPath, {
    cookie,
    method: 'PUT',
    body: { ...body, nextDueDate: '' },
  });
  assert.equal(cleared.data.vaccination.nextDueDate, null);
  assert.equal(cleared.data.vaccination.photo, testPhoto);
  assert.equal(
    (await request(path, { cookie, method: 'POST', body: { name: 'Rabies' } }))
      .status,
    400,
  );
  assert.equal(
    (
      await request(path, {
        cookie,
        method: 'POST',
        body: { ...body, nextDueDate: '2023-01-01' },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(path, {
        cookie,
        method: 'POST',
        body: { ...body, dateAdministered: '2099-01-01' },
      })
    ).status,
    400,
  );
  assert.equal(
    (await request(recordPath, { cookie, method: 'DELETE' })).status,
    204,
  );
});
