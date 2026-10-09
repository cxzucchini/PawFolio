import React from 'react';
import './brand.css';

// Preserve the original client-supplied path shapes and color in every variant.
export default function BrandLogo({ variant = 'full' }) {
  const assets = {
    full: { src: '/pawfolio-logo.svg', width: 668, height: 140 },
    icon: { src: '/pawfolio-icon.svg', width: 190, height: 240 },
    wordmark: { src: '/pawfolio-wordmark.svg', width: 668, height: 140 },
  };
  const asset = assets[variant] || assets.full;
  return (
    <img
      className={`brand-logo-image brand-logo-${variant}`}
      src={asset.src}
      alt="Pawfolio"
      width={asset.width}
      height={asset.height}
    />
  );
}
