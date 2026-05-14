import React from 'react';
import { cn } from '../../lib/utils';

type BadgeTone = 'default' | 'success' | 'warning' | 'danger' | 'muted';

const tones: Record<BadgeTone, string> = {
  default: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-300',
  success: 'border-green-200 bg-green-50 text-green-700 dark:border-green-500/40 dark:bg-green-500/10 dark:text-green-300',
  warning: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300',
  danger: 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300',
  muted: 'border-gray-200 bg-gray-50 text-gray-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300',
};

export const Badge = ({
  className,
  tone = 'default',
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) => (
  <span
    className={cn('inline-flex items-center rounded-none border px-2 py-0.5 text-[11px] font-bold', tones[tone], className)}
    {...props}
  />
);
