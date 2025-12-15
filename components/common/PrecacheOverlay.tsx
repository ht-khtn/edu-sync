'use client';

import React, { useEffect } from 'react';

type Props = {
  visible: boolean;
  done: number;
  total: number;
  onSkip: () => void;
  timeoutMs?: number;
};

export default function PrecacheOverlay({ visible, done, total, onSkip, timeoutMs = 15000 }: Props) {
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      onSkip();
    }, timeoutMs);
    return () => clearTimeout(timer);
  }, [visible, timeoutMs, onSkip]);

  if (!visible) return null;

  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        right: '0.75rem',
        bottom: '0.75rem',
        zIndex: 60,
      }}
    >
      <div
        style={{
          width: 320,
          background: '#111827',
          color: '#fff',
          padding: 14,
          borderRadius: 10,
          boxShadow: '0 10px 24px rgba(0,0,0,0.25)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontWeight: 600 }}>Chuẩn bị ứng dụng…</div>
          <button
            onClick={onSkip}
            aria-label="Bỏ qua"
            style={{
              background: 'transparent',
              color: '#e5e7eb',
              border: '1px solid #374151',
              borderRadius: 6,
              padding: '4px 8px',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Bỏ qua
          </button>
        </div>
        <div style={{ fontSize: 12, color: '#e5e7eb', marginBottom: 10 }}>
          Đang lưu bộ nhớ tạm: {done}/{total} ({pct}%)
        </div>
        <div style={{ height: 8, background: '#1f2937', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: '#10b981' }} />
        </div>
      </div>
    </div>
  );
}
