'use client';

import { hostAvailable, hostCall } from '@/lib/klaster/host';
import { useEffect, useState } from 'react';

/**
 * Почти прозрачная надпись АЛЬТ+Ф4 в правом верхнем углу окна обёртки.
 * Наводишь — проявляется; нажимаешь — приложение закрывается.
 * Показывается только внутри обёртки (в браузере моста нет).
 */
export function AltF4Hint() {
  const [host, setHost] = useState(false);

  useEffect(() => {
    setHost(hostAvailable());
  }, []);

  if (!host) return null;

  return (
    <button
      type="button"
      aria-label="Закрыть приложение (Альт+Ф4)"
      className="altf4-hint fixed right-2 top-1.5 z-[130] select-none"
      style={{
        fontSize: 11,
        lineHeight: 1,
        letterSpacing: '0.08em',
        padding: '4px 6px',
        borderRadius: 6,
        color: 'var(--text-secondary)',
        opacity: 0.12,
        cursor: 'pointer',
        background: 'transparent',
        transition: 'opacity 180ms ease',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.95')}
      onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.12')}
      onClick={() => {
        void hostCall('close').catch(() => {});
      }}
    >
      АЛЬТ+Ф4
    </button>
  );
}
