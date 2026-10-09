import { useCallback, useEffect, useRef, useState } from 'react';

export default function useLiveRefresh(
  refresh,
  { enabled = true, paused = false } = {},
) {
  const callback = useRef(refresh);
  callback.current = refresh;
  const run = useRef(() => {});
  const [phase, setPhase] = useState(navigator.onLine ? 'idle' : 'offline');
  const [updatedAt, setUpdatedAt] = useState(null);
  useEffect(() => {
    if (!enabled || paused) return;
    let active = true,
      pending = false,
      failures = 0,
      timer;
    const controller = new AbortController();
    async function update() {
      clearTimeout(timer);
      if (!active || pending) return;
      if (!navigator.onLine || document.visibilityState === 'hidden') {
        if (!navigator.onLine) setPhase('offline');
        timer = setTimeout(update, 15000);
        return;
      }
      pending = true;
      setPhase('syncing');
      try {
        await callback.current(controller.signal);
        if (active) {
          setUpdatedAt(Date.now());
          setPhase('idle');
          failures = 0;
        }
      } catch (error) {
        if (active && error.name !== 'AbortError') {
          failures++;
          setPhase(navigator.onLine ? 'error' : 'offline');
        }
      } finally {
        pending = false;
        if (active)
          timer = setTimeout(update, Math.min(60000, 15000 * 2 ** failures));
      }
    }
    const offline = () => setPhase('offline');
    const storage = (event) => {
      if (event.key === 'pawfolio-data-changed') update();
    };
    run.current = update;
    update();
    window.addEventListener('focus', update);
    window.addEventListener('online', update);
    window.addEventListener('offline', offline);
    window.addEventListener('pawfolio-data-changed', update);
    window.addEventListener('storage', storage);
    document.addEventListener('visibilitychange', update);
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
      run.current = () => {};
      window.removeEventListener('focus', update);
      window.removeEventListener('online', update);
      window.removeEventListener('offline', offline);
      window.removeEventListener('pawfolio-data-changed', update);
      window.removeEventListener('storage', storage);
      document.removeEventListener('visibilitychange', update);
    };
  }, [enabled, paused]);
  const refreshNow = useCallback(() => run.current(), []);
  return { phase, updatedAt, refreshNow };
}
