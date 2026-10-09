import React, { useEffect, useRef, useState } from 'react';
import { PawPrint, ChevronDown, Check } from 'lucide-react';

export default function DogSwitcher({ dogs, selected, disabled, onSelect }) {
  const [open, setOpen] = useState(false);
  const container = useRef(null);
  const trigger = useRef(null);
  const active = dogs.find((dog) => dog._id === selected);
  useEffect(() => {
    const dismiss = (event) => {
      if (!container.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, []);
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  function choose(id) {
    setOpen(false);
    trigger.current?.focus();
    onSelect(id);
  }
  return (
    <div
      className="dog-switcher"
      ref={container}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setOpen(false);
          trigger.current?.focus();
        }
        if (
          open &&
          ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)
        ) {
          event.preventDefault();
          const options = [
            ...container.current.querySelectorAll('.dog-switch-option'),
          ];
          const index = options.indexOf(document.activeElement);
          const next =
            event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? options.length - 1
                : event.key === 'ArrowDown'
                  ? (index + 1) % options.length
                  : index < 0
                    ? options.length - 1
                    : (index - 1 + options.length) % options.length;
          options[next]?.focus();
        }
      }}
    >
      <span className="dog-switch-label" id="dog-switch-label">
        ACTIVE DOG PROFILE
      </span>
      <button
        ref={trigger}
        type="button"
        className="dog-switch-trigger"
        disabled={disabled || !dogs.length}
        aria-expanded={open}
        aria-controls="dog-switch-options"
        aria-label={
          active
            ? `Switch dog, currently ${active.name}, ${active.breed}`
            : 'No dogs yet'
        }
        onClick={() => setOpen(!open)}
      >
        {active?.photo ? (
          <img className="switch-dog-photo" src={active.photo} alt="" />
        ) : (
          <PawPrint size={18} aria-hidden="true" />
        )}
        <span className="dog-switch-copy">
          <strong>{active?.name || 'No dogs yet'}</strong>
          {active && <small>{active.breed}</small>}
        </span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <div
          className="dog-switch-options"
          id="dog-switch-options"
          role="group"
          aria-labelledby="dog-switch-label"
        >
          {dogs.map((dog) => (
            <button
              type="button"
              key={dog._id}
              className="dog-switch-option"
              aria-pressed={dog._id === selected}
              onClick={() => choose(dog._id)}
            >
              <span className="dog-switch-copy">
                <strong>{dog.name}</strong>
                <small>{dog.breed}</small>
              </span>
              {dog._id === selected && <Check size={16} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
