import React, { useEffect } from 'react';
import { X, ShieldCheck, Users, Ship, Table2, Plus, Moon, Sun, LogOut, Settings } from 'lucide-react';
import { User } from '../types';

export interface DrawerNavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  onClick: () => void;
}

type AdminSection = 'users' | 'boats' | 'tables';

interface MobileNavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  items: DrawerNavItem[];
  currentModule: string;
  canDigitalize: boolean;
  canManageUsers: boolean;
  adminSection: AdminSection;
  onNewDigitalization: () => void;
  onSelectAdmin: (section: AdminSection) => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  canViewSettings: boolean;
  onOpenSettings: () => void;
  onLogout: () => void;
}

const ADMIN_SECTIONS: { id: AdminSection; label: string; icon: React.ElementType }[] = [
  { id: 'users', label: 'Usuarios', icon: Users },
  { id: 'boats', label: 'Embarcaciones', icon: Ship },
  { id: 'tables', label: 'Tablas asignadas', icon: Table2 },
];

/**
 * Panel lateral de navegación para móvil (solo admin/supervisor). Comparte handlers y permisos
 * con el sidebar desktop; solo cambia la presentación. Se cierra al navegar, tocar fuera o Escape.
 */
export default function MobileNavigationDrawer({
  isOpen,
  onClose,
  user,
  items,
  currentModule,
  canDigitalize,
  canManageUsers,
  adminSection,
  onNewDigitalization,
  onSelectAdmin,
  isDarkMode,
  onToggleTheme,
  canViewSettings,
  onOpenSettings,
  onLogout,
}: MobileNavigationDrawerProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Envuelve cada acción para cerrar el panel al navegar.
  const go = (fn: () => void) => () => {
    fn();
    onClose();
  };

  return (
    <div className="md:hidden fixed inset-0 z-[2100]">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm dark:bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Navegación principal"
        className="absolute inset-y-0 left-0 z-[2200] flex w-[82%] max-w-xs flex-col bg-white shadow-2xl animate-in slide-in-from-left duration-300 ease-out dark:bg-[#050505]"
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-gray-100 px-4 dark:border-zinc-900">
          <span className="text-xl font-bold tracking-tighter text-black dark:text-white">
            Bluegrid<span className="text-gray-500">OCR</span>
          </span>
          <button
            onClick={onClose}
            aria-label="Cerrar navegación"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-500 transition-colors hover:bg-gray-100 hover:text-black dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {canDigitalize && (
          <div className="px-4 py-4">
            <button
              onClick={go(onNewDigitalization)}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-none bg-black text-sm font-semibold text-white shadow-md transition-all active:scale-[0.98] dark:bg-white dark:text-black"
            >
              <Plus className="h-4 w-4" /> Nueva digitalización
            </button>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto px-3 pb-3">
          <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-1.5 dark:border-zinc-900 dark:bg-zinc-950/50">
            {items.map(item => {
              const Icon = item.icon;
              const active = currentModule === item.id;
              return (
                <button
                  key={item.id}
                  onClick={go(item.onClick)}
                  className={`group relative mb-1 flex h-11 w-full items-center gap-2.5 rounded-xl px-2.5 text-left text-sm font-medium transition-all last:mb-0 ${
                    active
                      ? 'bg-white text-black shadow-sm ring-1 ring-gray-200 dark:bg-zinc-900 dark:text-white dark:ring-zinc-800'
                      : 'text-gray-500 hover:bg-white/80 hover:text-black dark:text-zinc-500 dark:hover:bg-zinc-900/70 dark:hover:text-white'
                  }`}
                >
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
                    active
                      ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300'
                      : 'text-gray-400 group-hover:text-blue-600 dark:text-zinc-600 dark:group-hover:text-blue-300'
                  }`}>
                    <Icon className="h-4 w-4" strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0 truncate">{item.label}</span>
                  {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-600 dark:bg-blue-300" />}
                </button>
              );
            })}

            {canManageUsers && (
              <div className="mt-2 border-t border-gray-200 pt-2 dark:border-zinc-900">
                <p className="flex items-center gap-2 px-2.5 pb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-600">
                  <ShieldCheck className="h-3.5 w-3.5" /> Administración
                </p>
                {ADMIN_SECTIONS.map(section => {
                  const Icon = section.icon;
                  const active = currentModule === 'users' && adminSection === section.id;
                  return (
                    <button
                      key={section.id}
                      onClick={go(() => onSelectAdmin(section.id))}
                      className={`flex h-10 w-full items-center gap-2.5 rounded-xl px-2.5 text-left text-sm font-medium transition-colors ${
                        active
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300'
                          : 'text-gray-500 hover:bg-white hover:text-black dark:text-zinc-500 dark:hover:bg-zinc-900 dark:hover:text-white'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="min-w-0 truncate">{section.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        <div className="shrink-0 border-t border-gray-100 p-3 dark:border-zinc-900">
          <div className="mb-2 flex items-center gap-3 px-1">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black text-sm font-bold text-white dark:bg-white dark:text-black">
              {user.username.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-black dark:text-white">{user.name}</p>
              <p className="truncate text-[10px] font-medium uppercase tracking-widest text-gray-500">{user.role}</p>
            </div>
          </div>
          <button
            onClick={onToggleTheme}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-zinc-900"
          >
            {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {isDarkMode ? 'Modo Claro' : 'Modo Oscuro'}
          </button>
          {canViewSettings && (
            <button
              onClick={go(onOpenSettings)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-zinc-900"
            >
              <Settings className="h-4 w-4" />
              Ajustes
            </button>
          )}
          <button
            onClick={() => { onClose(); onLogout(); }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
          >
            <LogOut className="h-4 w-4" />
            Cerrar Sesión
          </button>
        </div>
      </aside>
    </div>
  );
}
