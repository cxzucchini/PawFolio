import { designPreviewEnabled, designPreviewData } from './designPreview.js';
export async function api(path, options = {}) {
  if (designPreviewEnabled()) return designPreviewData(path, options);
  let response;
  try {
    response = await fetch(`/api${path}`, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...options,
      headers: {
        'X-Pawfolio-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error(
      'Cannot connect to Pawfolio. Check that the server is running and try again.',
    );
  }
  function notifyChange() {
    if (!options.method || options.method.toUpperCase() === 'GET') return;
    window.dispatchEvent(new Event('pawfolio-data-changed'));
    try {
      localStorage.setItem(
        'pawfolio-data-changed',
        `${Date.now()}-${Math.random()}`,
      );
    } catch {}
  }
  if (response.status === 204) {
    notifyChange();
    return null;
  }
  const data = await response.json().catch(() => ({
    message: 'Pawfolio is not ready yet. Please try again in a moment.',
  }));
  if (!response.ok) {
    const error = new Error(
      data.message || 'Something went wrong. Please try again.',
    );
    error.status = response.status;
    throw error;
  }
  notifyChange();
  return data;
}

export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function localDateTime(date = new Date()) {
  return `${localDay(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
export function vaccineState(vaccine) {
  if (!vaccine.nextDueDate) return 'Administered';
  const due = vaccine.nextDueDate.slice(0, 10);
  return due < localDay() ? 'Overdue' : 'Upcoming';
}
