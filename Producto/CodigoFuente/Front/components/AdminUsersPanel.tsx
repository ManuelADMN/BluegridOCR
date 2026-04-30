import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { authFetch } from '../services/apiClient';
import { UserPlus, Loader2 } from 'lucide-react';

type Props = {
  apiUrl: string;
  currentUser: User | null;
  onNotify: (message: string, type?: 'success' | 'error') => void;
};

export default function AdminUsersPanel({ apiUrl, currentUser, onNotify }: Props) {
  const [username, setUsername] = useState('');
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState<UserRole>('buzo');
  const [isSaving, setIsSaving] = useState(false);

  const createUser = async () => {
    if (!currentUser || currentUser.role !== 'admin') {
      onNotify('No tienes permisos para crear usuarios', 'error');
      return;
    }

    if (!username.trim() || !nombreCompleto.trim() || !password.trim()) {
      onNotify('Completa todos los campos obligatorios', 'error');
      return;
    }

    if (password.trim().length < 6) {
      onNotify('La contraseña debe tener al menos 6 caracteres', 'error');
      return;
    }

    setIsSaving(true);

    try {
      const response = await authFetch(`${apiUrl}/api/v1/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          nombre_completo: nombreCompleto,
          password,
          rol,
        }),
      });

      if (!response.ok) {
        const txt = await response.text();
        throw new Error(txt || 'Error al crear usuario');
      }

      onNotify('Usuario creado correctamente', 'success');
      setUsername('');
      setNombreCompleto('');
      setPassword('');
      setRol('buzo');
    } catch (error: any) {
      onNotify(error.message || 'Error al crear usuario', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="animate-in fade-in zoom-in duration-300 w-full h-full max-w-3xl mx-auto px-4 md:px-8 pt-8">
      <div className="mb-8">
        <h2 className="text-3xl font-semibold tracking-tighter text-black dark:text-white">
          Administración de Usuarios
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          Crea usuarios para operación, supervisión y administración del sistema BluegridOCR.
        </p>
      </div>

      <div className="bg-white dark:bg-[#050505] border border-gray-200 dark:border-zinc-800 rounded-[2rem] p-6 shadow-sm space-y-5">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Usuario
            </label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="ej: buzo01"
              className="mt-2 w-full h-11 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 text-sm outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Nombre completo
            </label>
            <input
              value={nombreCompleto}
              onChange={e => setNombreCompleto(e.target.value)}
              placeholder="ej: Operador de Buceo 01"
              className="mt-2 w-full h-11 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 text-sm outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="mt-2 w-full h-11 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 text-sm outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Rol
            </label>
            <select
              value={rol}
              onChange={e => setRol(e.target.value as UserRole)}
              className="mt-2 w-full h-11 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 text-sm outline-none"
            >
              <option value="buzo">Buzo</option>
              <option value="supervisor">Supervisor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>

        <button
          onClick={createUser}
          disabled={isSaving}
          className="w-full h-11 rounded-xl bg-black dark:bg-white text-white dark:text-black font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
          Crear Usuario
        </button>
      </div>
    </div>
  );
}
