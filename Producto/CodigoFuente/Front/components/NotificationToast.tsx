import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, ServerCrash, X } from 'lucide-react';

export type NotificationTone = 'success' | 'error' | 'warning' | 'info';

interface NotificationToastProps {
  message: string;
  type: NotificationTone;
  title?: string;
  onClose: () => void;
  duration?: number;
}

const toneConfig = {
  success: {
    title: 'Operación completada',
    icon: CheckCircle2,
    border: 'border-green-200 dark:border-green-500/30',
    marker: 'bg-green-500',
    iconClass: 'text-green-600 dark:text-green-400',
  },
  error: {
    title: 'Requiere atención',
    icon: ServerCrash,
    border: 'border-red-200 dark:border-red-500/30',
    marker: 'bg-red-500',
    iconClass: 'text-red-600 dark:text-red-400',
  },
  warning: {
    title: 'Revisión sugerida',
    icon: AlertTriangle,
    border: 'border-amber-200 dark:border-amber-500/30',
    marker: 'bg-amber-500',
    iconClass: 'text-amber-600 dark:text-amber-400',
  },
  info: {
    title: 'Actualización',
    icon: Info,
    border: 'border-blue-200 dark:border-blue-500/30',
    marker: 'bg-blue-500',
    iconClass: 'text-blue-600 dark:text-blue-400',
  },
};

const NotificationToast: React.FC<NotificationToastProps> = ({
  message,
  type,
  title,
  onClose,
  duration = 4200,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const config = toneConfig[type];
  const Icon = config.icon;

  useEffect(() => {
    const enterTimer = setTimeout(() => setIsVisible(true), 10);
    const exitTimer = setTimeout(() => setIsVisible(false), duration - 300);
    const closeTimer = setTimeout(onClose, duration);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(exitTimer);
      clearTimeout(closeTimer);
    };
  }, [onClose, duration]);

  return (
    <div
      className={`
        fixed bottom-5 right-5 z-[4000] flex w-[calc(100vw-2rem)] max-w-sm items-stretch overflow-hidden border bg-white shadow-2xl transition-all duration-300 ease-in-out dark:bg-[#080809]
        ${config.border}
        ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}
      `}
      role="alert"
    >
      <div className={`w-1 shrink-0 ${config.marker}`} />
      <div className="flex shrink-0 items-center px-3">
        <Icon className={`h-5 w-5 ${config.iconClass}`} />
      </div>

      <div className="min-w-0 flex-1 py-3 pr-2">
        <h3 className="text-sm font-semibold text-black dark:text-white">
          {title || config.title}
        </h3>
        <div className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
          {message}
        </div>
      </div>

      <button
        onClick={() => {
          setIsVisible(false);
          setTimeout(onClose, 300);
        }}
        className="group m-2 flex h-8 w-8 flex-shrink-0 items-center justify-center bg-transparent text-gray-400 hover:bg-gray-100 hover:text-black focus:outline-none focus:ring-2 focus:ring-black dark:text-gray-500 dark:hover:bg-zinc-900 dark:hover:text-white"
      >
        <span className="sr-only">Cerrar</span>
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export default NotificationToast;
