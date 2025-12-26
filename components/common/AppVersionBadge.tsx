'use client';

import React from 'react';
import { BUILD_INFO } from '@/configs/generated/build-info'

export default function AppVersionBadge() {
  const version = BUILD_INFO?.version ?? 'dev';

  return (
    <div
      aria-label="App version"
      style={{
        position: 'fixed',
        left: '0.5rem',
        bottom: '0.5rem',
        zIndex: 50,
        padding: '0.25rem 0.5rem',
        borderRadius: '0.375rem',
        fontSize: '0.75rem',
        lineHeight: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        color: '#fff',
        backdropFilter: 'saturate(150%) blur(6px)',
      }}
      title={`Version ${version}`}
    >
      v{version}
    </div>
  );
}
