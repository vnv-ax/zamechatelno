

'use client';

import type { ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function Hint({
  label,
  desc,
  children,
  side = 'bottom',
}: {
  label: string;
  desc?: string;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
}) {
  return (
    <Tooltip delayDuration={350}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>
        <span style={{ fontWeight: 500 }}>{label}</span>
        {desc ? <span style={{ color: 'var(--text-muted)' }}> · {desc}</span> : null}
      </TooltipContent>
    </Tooltip>
  );
}
