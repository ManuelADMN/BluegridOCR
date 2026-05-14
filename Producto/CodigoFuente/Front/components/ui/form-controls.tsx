import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

type Option = {
  value: string;
  label: string;
};

const baseControl =
  'h-10 w-full border border-gray-200 bg-white px-3 text-sm font-medium text-gray-900 outline-none transition-colors hover:border-gray-300 focus:border-blue-500 dark:border-zinc-800 dark:bg-[#111113] dark:text-white dark:hover:border-zinc-700 dark:focus:border-blue-400';

const months = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const weekdays = ['lu', 'ma', 'mi', 'ju', 'vi', 'sá', 'do'];

const pad = (value: number) => String(value).padStart(2, '0');

const toISO = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const fromISO = (value?: string) => {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const formatDate = (value?: string) => {
  const date = fromISO(value);
  if (!date) return '';
  return date.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatRangeDate = (value?: string, includeYear = true) => {
  const date = fromISO(value);
  if (!date) return '';
  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
  };
  if (includeYear) options.year = 'numeric';
  return date.toLocaleDateString('es-CL', options);
};

function useOutsideClose(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return ref;
}

export function SelectControl({
  value,
  options,
  onChange,
  placeholder = 'Seleccionar',
  className,
  buttonClassName,
}: {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(() => setOpen(false));
  const selected = options.find(option => option.value === value);

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen(current => !current)}
        className={cn(baseControl, 'flex items-center justify-between gap-2 text-left', buttonClassName)}
      >
        <span className={cn('min-w-0 truncate', !selected && 'text-gray-400')}>
          {selected?.label || placeholder}
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-gray-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-[3500] w-full min-w-44 border border-gray-200 bg-white p-1 shadow-xl dark:border-zinc-800 dark:bg-[#0b0b0c]">
          {options.map(option => (
            <button
              key={option.value || '__empty'}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={cn(
                'flex h-9 w-full items-center px-3 text-left text-sm font-medium transition-colors hover:bg-gray-100 dark:hover:bg-zinc-900',
                option.value === value
                  ? 'bg-blue-600 text-white hover:bg-blue-600 dark:bg-blue-600 dark:text-white'
                  : 'text-gray-800 dark:text-zinc-200'
              )}
            >
              <span className="truncate">{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function DatePickerControl({
  value,
  onChange,
  placeholder = 'Seleccionar fecha',
  className,
  buttonClassName,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedDate = fromISO(value);
  const [viewDate, setViewDate] = useState(selectedDate || new Date());
  const ref = useOutsideClose(() => setOpen(false));

  useEffect(() => {
    if (selectedDate) setViewDate(selectedDate);
  }, [value]);

  const days = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const first = new Date(year, month, 1);
    const startOffset = (first.getDay() + 6) % 7;
    const start = new Date(year, month, 1 - startOffset);
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [viewDate]);

  const moveMonth = (delta: number) => {
    setViewDate(current => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  };

  const todayISO = toISO(new Date());

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen(current => !current)}
        className={cn(baseControl, 'flex items-center justify-between gap-2 text-left', buttonClassName)}
      >
        <span className={cn('min-w-0 truncate', !value && 'text-gray-400')}>
          {value ? formatDate(value) : placeholder}
        </span>
        <CalendarDays className="h-4 w-4 shrink-0 text-gray-400" />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+4px)] z-[3600] w-72 border border-gray-200 bg-white p-3 shadow-xl dark:border-zinc-800 dark:bg-[#0b0b0c]">
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => moveMonth(-1)}
              className="flex h-8 w-8 items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white"
              title="Mes anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-sm font-bold text-gray-950 dark:text-white">
              {months[viewDate.getMonth()]} {viewDate.getFullYear()}
            </div>
            <button
              type="button"
              onClick={() => moveMonth(1)}
              className="flex h-8 w-8 items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white"
              title="Mes siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] font-bold uppercase text-gray-400">
            {weekdays.map(day => <div key={day}>{day}</div>)}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map(date => {
              const iso = toISO(date);
              const currentMonth = date.getMonth() === viewDate.getMonth();
              const selected = iso === value;
              const today = iso === todayISO;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => {
                    onChange(iso);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex h-8 items-center justify-center text-sm font-medium transition-colors',
                    selected
                      ? 'bg-blue-600 text-white hover:bg-blue-600'
                      : 'text-gray-800 hover:bg-gray-100 dark:text-zinc-200 dark:hover:bg-zinc-900',
                    !currentMonth && !selected && 'text-gray-400 dark:text-zinc-600',
                    today && !selected && 'border border-blue-500 text-blue-600 dark:text-blue-400'
                  )}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex justify-between border-t border-gray-100 pt-3 text-xs font-semibold dark:border-zinc-900">
            <button type="button" onClick={() => onChange('')} className="text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white">
              Limpiar
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(todayISO);
                setOpen(false);
              }}
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              Hoy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function DateRangePickerControl({
  startValue,
  endValue,
  onChange,
  placeholder = 'Seleccionar periodo',
  className,
  buttonClassName,
}: {
  startValue: string;
  endValue: string;
  onChange: (startValue: string, endValue: string) => void;
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [selectionStep, setSelectionStep] = useState<'start' | 'end'>('start');
  const selectedStart = fromISO(startValue);
  const selectedEnd = fromISO(endValue);
  const [viewDate, setViewDate] = useState(selectedStart || selectedEnd || new Date());
  const ref = useOutsideClose(() => {
    setOpen(false);
    setSelectionStep('start');
  });

  useEffect(() => {
    if (selectedStart) setViewDate(selectedStart);
    else if (selectedEnd) setViewDate(selectedEnd);
  }, [startValue, endValue]);

  const days = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const first = new Date(year, month, 1);
    const startOffset = (first.getDay() + 6) % 7;
    const start = new Date(year, month, 1 - startOffset);
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [viewDate]);

  const moveMonth = (delta: number) => {
    setViewDate(current => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  };

  const handleSelect = (iso: string) => {
    if (selectionStep === 'start') {
      onChange(iso, '');
      setSelectionStep('end');
      return;
    }

    const start = fromISO(startValue);
    const end = fromISO(iso);
    if (start && end && end < start) onChange(iso, startValue);
    else onChange(startValue, iso);
    setSelectionStep('start');
    setOpen(false);
  };

  const todayISO = toISO(new Date());
  const label = startValue && endValue
    ? `${formatRangeDate(startValue, false)} - ${formatRangeDate(endValue)}`
    : startValue
      ? `${formatRangeDate(startValue)} - ...`
      : endValue
        ? `... - ${formatRangeDate(endValue)}`
        : placeholder;

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => {
          setOpen(current => !current);
          setSelectionStep('start');
        }}
        className={cn(baseControl, 'flex items-center justify-between gap-2 text-left', buttonClassName)}
      >
        <span className={cn('min-w-0 truncate', !startValue && !endValue && 'text-gray-400')}>
          {label}
        </span>
        <CalendarDays className="h-4 w-4 shrink-0 text-gray-400" />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+4px)] z-[3600] w-72 border border-gray-200 bg-white p-3 shadow-xl dark:border-zinc-800 dark:bg-[#0b0b0c]">
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => moveMonth(-1)}
              className="flex h-8 w-8 items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white"
              title="Mes anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-center">
              <div className="text-sm font-bold text-gray-950 dark:text-white">
                {months[viewDate.getMonth()]} {viewDate.getFullYear()}
              </div>
              <div className="text-[11px] font-semibold text-gray-400">
                {selectionStep === 'start' ? 'Fecha inicial' : 'Fecha final'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => moveMonth(1)}
              className="flex h-8 w-8 items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white"
              title="Mes siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] font-bold uppercase text-gray-400">
            {weekdays.map(day => <div key={day}>{day}</div>)}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map(date => {
              const iso = toISO(date);
              const currentMonth = date.getMonth() === viewDate.getMonth();
              const selected = iso === startValue || iso === endValue;
              const inRange = selectedStart && selectedEnd && date > selectedStart && date < selectedEnd;
              const today = iso === todayISO;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => handleSelect(iso)}
                  className={cn(
                    'flex h-8 items-center justify-center text-sm font-medium transition-colors',
                    selected
                      ? 'bg-blue-600 text-white hover:bg-blue-600'
                      : inRange
                        ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/20'
                        : 'text-gray-800 hover:bg-gray-100 dark:text-zinc-200 dark:hover:bg-zinc-900',
                    !currentMonth && !selected && !inRange && 'text-gray-400 dark:text-zinc-600',
                    today && !selected && 'border border-blue-500 text-blue-600 dark:text-blue-400'
                  )}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex justify-between border-t border-gray-100 pt-3 text-xs font-semibold dark:border-zinc-900">
            <button
              type="button"
              onClick={() => {
                onChange('', '');
                setSelectionStep('start');
              }}
              className="text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white"
            >
              Limpiar
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(todayISO, todayISO);
                setSelectionStep('start');
                setOpen(false);
              }}
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              Hoy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
