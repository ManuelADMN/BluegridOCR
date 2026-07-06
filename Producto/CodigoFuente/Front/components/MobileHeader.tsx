import React, { useEffect, useRef, useState } from 'react';
import { Menu, Moon, Sun, LogOut, Settings, ChevronDown } from 'lucide-react';
import { User } from '../types';

interface MobileHeaderProps {
  user: User;
  /** Muestra el botón hamburguesa. Solo true para roles con navegación (admin/supervisor). */
  hasNav: boolean;
  onOpenNav: () => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  canViewSettings: boolean;
  onOpenSettings: () => void;
  onLogout: () => void;
  onLogoClick?: () => void;
}

/**
 * Encabezado móvil fijo (md:hidden). Vive fuera del área scrolleable, así que permanece
 * visible mientras el contenido se desplaza. El buzo NO ve hamburguesa, pero SÍ tiene aquí
 * su único acceso a tema y cierre de sesión (el menú de perfil del sidebar desktop queda oculto).
 */
export default function MobileHeader({
  user,
  hasNav,
  onOpenNav,
  isDarkMode,
  onToggleTheme,
  canViewSettings,
  onOpenSettings,
  onLogout,
  onLogoClick,
}: MobileHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  return (
    <header className="md:hidden flex h-16 shrink-0 items-center justify-between gap-2 border-b border-gray-200 bg-white/95 px-4 backdrop-blur dark:border-zinc-900 dark:bg-[#050505]/95 z-40">
      <div className="flex min-w-0 items-center gap-1.5">
        {hasNav && (
          <button
            onClick={onOpenNav}
            aria-label="Abrir navegación"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-gray-600 transition-colors hover:bg-gray-100 hover:text-black dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-white"
          >
            <Menu className="h-5 w-5" strokeWidth={1.8} />
          </button>
        )}
        <button
          onClick={onLogoClick}
          className="truncate text-xl font-bold tracking-tighter text-black dark:text-white"
        >
          Bluegrid<span className="text-gray-500">OCR</span>
        </button>
      </div>

      <div className="relative shrink-0" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(o => !o)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label="Menú de perfil"
          className="flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-gray-100 dark:hover:bg-zinc-900"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-sm font-bold text-white shadow-sm dark:bg-white dark:text-black">
            {user.username.charAt(0).toUpperCase()}
          </span>
          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full z-50 mt-2 w-56 rounded-2xl border border-gray-200 bg-white py-2 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200 dark:border-zinc-800 dark:bg-[#18181b]"
          >
            <div className="mb-2 border-b border-gray-100 px-4 py-3 dark:border-zinc-800">
              <p className="truncate text-sm font-semibold text-black dark:text-white">{user.name}</p>
              <p className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-widest text-gray-500">{user.role}</p>
            </div>

            <button
              onClick={() => { onToggleTheme(); }}
              className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-zinc-800/50"
            >
              {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {isDarkMode ? 'Modo Claro' : 'Modo Oscuro'}
            </button>

            {canViewSettings && (
              <button
                onClick={() => { onOpenSettings(); setMenuOpen(false); }}
                className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-zinc-800/50"
              >
                <Settings className="h-4 w-4" />
                Ajustes
              </button>
            )}

            <div className="my-2 h-px bg-gray-100 dark:bg-zinc-800" />

            <button
              onClick={() => { setMenuOpen(false); onLogout(); }}
              className="flex w-full items-center gap-3 px-4 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
            >
              <LogOut className="h-4 w-4" />
              Cerrar Sesión
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
