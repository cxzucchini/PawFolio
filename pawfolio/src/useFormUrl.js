import { useEffect, useState } from 'react';
import { designPreviewEnabled } from './designPreview.js';

// Preview URLs describe the visible form so copying the address captures it.
export default function useFormUrl(initial, formName) {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    const sync = () => {
      if (!designPreviewEnabled()) return;
      const form = new URLSearchParams(window.location.search).get('form');
      setValue(
        formName
          ? form === formName
          : [
                'add-dog',
                'edit-dog',
                'vaccine',
                'vaccine-appointment',
                'reminder',
                'grooming',
              ].includes(form)
            ? form
            : null,
      );
    };
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, [formName]);
  function update(next) {
    if (designPreviewEnabled()) {
      const url = new URL(window.location.href);
      const form = formName ? (next ? formName : null) : next;
      if (form) url.searchParams.set('form', form);
      else url.searchParams.delete('form');
      url.searchParams.set('designPreview', '1');
      if (url.href !== window.location.href) {
        const method = form ? 'pushState' : 'replaceState';
        window.history[method]({}, '', url.pathname + url.search + url.hash);
      }
    }
    setValue(next);
  }
  return [value, update];
}
