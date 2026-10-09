import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ZoomIn, ZoomOut } from 'lucide-react';

export function ClickablePhoto({ photo, alt, className = '', loading }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={`photo-open ${className}`}
        aria-label={`View full photo: ${alt}`}
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
      >
        <img src={photo} alt={alt} loading={loading} />
      </button>
      {open &&
        createPortal(
          <PhotoViewer
            photo={photo}
            alt={alt}
            onClose={() => setOpen(false)}
          />,
          document.body,
        )}
    </>
  );
}
function PhotoViewer({ photo, alt, onClose }) {
  const dialog = useRef(null);
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    const node = dialog.current;
    node.showModal();
    return () => node.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="photo-viewer"
      aria-label={`Full photo: ${alt}`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="photo-viewer-toolbar">
        <span>{alt}</span>
        <button
          type="button"
          onClick={() => setZoom((value) => Math.max(1, value - 0.5))}
          disabled={zoom <= 1}
          aria-label="Zoom out"
        >
          <ZoomOut size={20} />
        </button>
        <button
          type="button"
          onClick={() => setZoom((value) => Math.min(3, value + 0.5))}
          disabled={zoom >= 3}
          aria-label="Zoom in"
        >
          <ZoomIn size={20} />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close full photo"
          autoFocus
        >
          <X size={22} />
        </button>
      </div>
      <div className="photo-viewer-image">
        <img
          src={photo}
          alt={alt}
          style={{
            width: zoom === 1 ? 'auto' : `${zoom * 100}%`,
            maxWidth: zoom === 1 ? '100%' : 'none',
            maxHeight: zoom === 1 ? '100%' : 'none',
          }}
        />
      </div>
    </dialog>
  );
}
export default function PhotoPicker({
  value,
  onChange,
  onBusy,
  label = 'Photo',
}) {
  const input = useRef(null);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  async function choose(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size > 10 * 1024 * 1024
    ) {
      setError('Choose a JPEG, PNG, or WebP photo up to 10 MB.');
      event.target.value = '';
      return;
    }
    setProcessing(true);
    onBusy(true);
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const scale = Math.min(
        1,
        1600 / Math.max(image.naturalWidth, image.naturalHeight),
      );
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      let photo;
      for (const quality of [0.85, 0.7, 0.55, 0.4]) {
        photo = canvas.toDataURL('image/jpeg', quality);
        if (photo.length <= 680000) break;
      }
      if (photo.length > 680000)
        throw new Error(
          'This photo is too large after resizing. Try a smaller image.',
        );
      onChange(photo);
    } catch (failure) {
      setError(
        failure.message || 'Could not read this photo. Choose another image.',
      );
    } finally {
      URL.revokeObjectURL(url);
      setProcessing(false);
      onBusy(false);
      event.target.value = '';
    }
  }
  return (
    <div className="photo-picker">
      <label>
        {label}
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={choose}
          disabled={processing}
        />
      </label>
      <small>JPEG, PNG, or WebP up to 10 MB. Resized automatically.</small>
      {processing && <p role="status">Preparing photo…</p>}
      {value && (
        <div className="photo-preview">
          <ClickablePhoto photo={value} alt={`${label} preview`} />
          <button
            type="button"
            className="subtle-button"
            onClick={() => onChange('')}
          >
            Remove photo
          </button>
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
export function DogAvatar({ dog, children, interactive = true }) {
  return (
    <span className="dog-avatar">
      {dog.photo ? (
        interactive ? (
          <ClickablePhoto photo={dog.photo} alt={`${dog.name} portrait`} />
        ) : (
          <img src={dog.photo} alt={`${dog.name} portrait`} />
        )
      ) : (
        children
      )}
    </span>
  );
}
export function RecordPhoto({ photo, title }) {
  return photo ? (
    <details className="record-photo">
      <summary>View photo attachment</summary>
      <ClickablePhoto
        photo={photo}
        alt={`Photo attached to ${title}`}
        loading="lazy"
      />
    </details>
  ) : null;
}
