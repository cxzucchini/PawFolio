import React, { useRef, useState } from 'react';
import { CalendarDays } from 'lucide-react';
export default function DateInput({
  name,
  type = 'date',
  defaultValue = '',
  required,
  min,
  max,
}) {
  const [date, setDate] = useState(defaultValue.slice(0, 10));
  const [text, setText] = useState(
    date
      ? [date.slice(5, 7), date.slice(8, 10), date.slice(0, 4)].join('/')
      : '',
  );
  const [time, setTime] = useState(defaultValue.slice(11, 16));
  const picker = useRef(null);
  const input = useRef(null);
  const withTime = type === 'datetime-local';
  function change(value) {
    setText(value);
    const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    const iso = match ? `${match[3]}-${match[1]}-${match[2]}` : '';
    const parsed = new Date(`${iso}T12:00:00Z`);
    const valid =
      iso &&
      Number.isFinite(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === iso &&
      (!min || iso >= min) &&
      (!max || iso <= max);
    input.current.setCustomValidity(
      value && !valid
        ? 'Enter a valid date as MM/DD/YYYY within the allowed range.'
        : '',
    );
    setDate(valid ? iso : '');
  }
  function formatTypedDate(event) {
    const field = event.target;
    const raw = field.value;
    const cursor = field.selectionStart ?? raw.length;
    const digitsBeforeCursor = raw.slice(0, cursor).replace(/\D/g, '').length;
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    const formatted = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)]
      .filter(Boolean)
      .join('/');
    change(formatted);
    let position = 0;
    let seen = 0;
    while (position < formatted.length && seen < digitsBeforeCursor) {
      if (/\d/.test(formatted[position])) seen++;
      position++;
    }
    if (formatted[position] === '/' && event.nativeEvent.inputType !== 'deleteContentBackward') position++;
    requestAnimationFrame(() => {
      if (document.activeElement === field) field.setSelectionRange(position, position);
    });
  }
  return (
    <span className="date-input">
      <span className="date-input-row">
        <input
          ref={input}
          type="text"
          inputMode="numeric"
          placeholder="MM/DD/YYYY"
          value={text}
          onChange={formatTypedDate}
          onKeyDown={(event) => {
            const field = event.currentTarget;
            const start = field.selectionStart;
            if (start !== field.selectionEnd) return;
            if (event.key === 'Backspace' && start > 0 && text[start - 1] === '/') {
              field.setSelectionRange(start - 2, start);
            } else if (event.key === 'Delete' && text[start] === '/') {
              field.setSelectionRange(start, start + 2);
            }
          }}
          required={required}
        />
        <button
          type="button"
          aria-label="Open calendar"
          onClick={() => picker.current.showPicker?.()}
        >
          <CalendarDays size={18} />
        </button>
        <input
          className="calendar-picker"
          ref={picker}
          type="date"
          aria-label="Choose calendar date"
          min={min}
          max={max}
          value={date}
          tabIndex={-1}
          onChange={(event) => {
            change(event.target.value ?
              [
                event.target.value.slice(5, 7),
                event.target.value.slice(8, 10),
                event.target.value.slice(0, 4),
              ].join('/') : '',
            );
          }}
        />
      </span>
      {withTime && (
        <input
          type="time"
          aria-label="Time"
          required={required}
          value={time}
          onChange={(event) => setTime(event.target.value)}
        />
      )}
      <input
        type="hidden"
        name={name}
        value={date ? (withTime ? `${date}T${time}` : date) : ''}
      />
    </span>
  );
}
