export function designPreviewEnabled() {
  return (
    new URLSearchParams(window.location.search).get('designPreview') === '1'
  );
}
export function designPreviewData(path, options = {}) {
  if (options.method && options.method.toUpperCase() !== 'GET') {
    throw new Error(
      'Design preview uses sample data. Sign in to the main website to save changes or send messages.',
    );
  }
  const today = new Date();
  const day = (offset) =>
    new Date(today.getTime() + offset * 86400000).toISOString();
  const dog = {
    _id: 'design-dog',
    name: 'Lukas',
    breed: 'Golden Retriever',
    gender: 'Male',
    dateOfBirth: '2022-03-10',
    weight: 28,
    photo: '/golden-retriever.jpg',
    veterinarian: 'Dr. Rivera',
    microchip: '',
  };
  if (path === '/auth/me')
    return {
      user: {
        id: 'design-user',
        firstName: 'Jay',
        lastName: 'Santos',
        email: 'jay@example.com',
        username: 'design_preview',
      },
      temporaryDatabase: false,
    };
  if (path === '/health') return { temporaryDatabase: false };
  if (path === '/dogs') return { dogs: [dog] };
  if (path.endsWith('/dashboard'))
    return {
      dog,
      vaccinations: [
        {
          _id: 'design-vaccine',
          name: 'Rabies',
          dateAdministered: day(-300),
          nextDueDate: day(5),
          clinic: 'Paws & Care Veterinary Clinic',
          veterinarian: 'Dr. Rivera',
        },
      ],
      reminders: [
        {
          _id: 'design-reminder',
          title: 'Bath and nail trim',
          type: 'Grooming',
          scheduledAt: day(3),
          completed: false,
          remindBeforeMinutes: 1440,
        },
      ],
    };
  if (path.endsWith('/medical'))
    return {
      records: [
        {
          _id: 'design-medical',
          title: 'Yearly checkup',
          category: 'Checkup',
          visitedAt: day(-30),
          clinic: 'Paws & Care Veterinary Clinic',
          veterinarian: 'Dr. Rivera',
          notes: 'Weight is 28 kg. Appetite and activity are normal. Continue the current food and return if anything changes.',
        },
      ],
    };
  if (path.endsWith('/emergency'))
    return {
      profile: {
        contactName: 'Jay Santos',
        contactPhone: '',
        clinic: 'Paws & Care Veterinary Clinic',
        clinicPhone: '',
        allergies: 'No known allergies',
        medications: 'None',
        conditions: 'None',
        instructions: 'Call Jay first. Lukas gets nervous around other dogs, so keep him on a leash while waiting at the clinic.',
      },
    };
  return {};
}
