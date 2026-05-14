import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Edit3,
  KeyRound,
  Loader2,
  PlusCircle,
  RefreshCw,
  Search,
  Shield,
  Ship,
  Table2,
  Trash2,
  UserCog,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { User, UserRole } from '../types';
import { authFetch } from '../services/apiClient';
import { formatChileDateTime } from '../lib/time';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { SelectControl } from './ui/form-controls';

type Props = {
  apiUrl: string;
  currentUser: User | null;
  onNotify: (message: string, type?: 'success' | 'error') => void;
  activeSection?: 'users' | 'boats' | 'tables';
  onSectionChange?: (section: 'users' | 'boats' | 'tables') => void;
};

type AdminUser = {
  id_usuario: number;
  username: string;
  correo?: string;
  rut?: string;
  nombre_completo: string;
  activo: boolean;
  created_at?: string;
  last_login_at?: string | null;
  rol: UserRole | string;
  fk_embarcacion?: number | null;
  id_tablilla?: string | null;
};

type Embarcacion = {
  id: number;
  name: string;
  matricula: string;
  capacidad_personas?: number;
  estado?: string;
  tablas_asociadas?: number;
};

type Tablilla = {
  id: number;
  codigo_tablilla: string;
  fk_embarcacion?: number | null;
  embarcacion?: string | null;
  matricula?: string | null;
  nombre_referencia?: string | null;
  descripcion?: string | null;
  estado?: string;
  origen?: string;
  updated_at?: string;
};

type UserAnalytics = {
  summary?: {
    total?: number;
    activos?: number;
    inactivos?: number;
    con_login?: number;
    ultimo_login?: string | null;
  };
  roles?: Array<{ rol: string; total: number }>;
  activity?: Array<{ usuario: string; digitalizaciones: number; validadas: number }>;
  audit?: Array<{ accion: string; entidad_id: string; username: string; rol: string; created_at: string }>;
};

type FormState = {
  id_usuario?: number;
  username: string;
  nombre_completo: string;
  password: string;
  rol: UserRole;
  activo: boolean;
  fk_embarcacion?: number | '';
  id_tablilla?: string;
};

const emptyForm: FormState = {
  username: '',
  nombre_completo: '',
  password: '',
  rol: 'buzo',
  activo: true,
  fk_embarcacion: '',
  id_tablilla: '',
};

const emptyBoatForm = {
  matricula: '',
  nombre_nave: '',
  capacidad_personas: 0,
};

const emptyTableForm = {
  id_tablilla: '',
  codigo_tablilla: '',
  fk_embarcacion: '',
  nombre_referencia: '',
  descripcion: '',
  estado: 'ACTIVA',
};

const inputClass =
  'h-10 w-full border border-gray-200 bg-white px-3 text-sm font-medium text-black outline-none transition-colors placeholder:text-gray-400 focus:border-blue-500 dark:border-zinc-800 dark:bg-[#050505] dark:text-white dark:focus:border-blue-400';

const roleOptions = [
  { value: '', label: 'Todos los roles' },
  { value: 'admin', label: 'Admin' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'buzo', label: 'Buzo' },
];

const statusOptions = [
  { value: '', label: 'Todos los estados' },
  { value: 'activo', label: 'Activos' },
  { value: 'inactivo', label: 'Inactivos' },
];

const formRoleOptions = roleOptions.filter(option => option.value);

const boatStatusOptions = [
  { value: 'ACTIVA', label: 'Activa' },
  { value: 'INACTIVA', label: 'Inactiva' },
  { value: 'MANTENCION', label: 'Mantención' },
  { value: 'BAJA', label: 'Baja' },
];

const roleLabel = (role?: string) => {
  const normalized = String(role || '').toLowerCase();
  if (normalized === 'admin') return 'Admin';
  if (normalized === 'supervisor') return 'Supervisor';
  return 'Buzo';
};

const roleTone = (role?: string): 'default' | 'success' | 'warning' | 'danger' | 'muted' => {
  const normalized = String(role || '').toLowerCase();
  if (normalized === 'admin') return 'danger';
  if (normalized === 'supervisor') return 'default';
  return 'muted';
};

const actionLabel = (action?: string) => {
  switch (action) {
    case 'user_created':
      return 'Usuario creado';
    case 'user_updated':
      return 'Usuario actualizado';
    case 'user_deactivated':
      return 'Usuario desactivado';
    case 'user_deleted':
      return 'Usuario eliminado';
    default:
      return action || 'Evento';
  }
};

export default function AdminUsersPanel({ apiUrl, currentUser, onNotify, activeSection = 'users', onSectionChange }: Props) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [boats, setBoats] = useState<Embarcacion[]>([]);
  const [tables, setTables] = useState<Tablilla[]>([]);
  const [analytics, setAnalytics] = useState<UserAnalytics>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [boatFormOpen, setBoatFormOpen] = useState(false);
  const [tableFormOpen, setTableFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [boatForm, setBoatForm] = useState(emptyBoatForm);
  const [tableForm, setTableForm] = useState(emptyTableForm);
  const [confirmDelete, setConfirmDelete] = useState<AdminUser | null>(null);

  const isEditing = Boolean(form.id_usuario);

  const fetchData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const [usersResponse, analyticsResponse] = await Promise.all([
        authFetch(`${apiUrl}/api/v1/users`),
        authFetch(`${apiUrl}/api/v1/users/analytics`),
      ]);

      if (!usersResponse.ok) throw new Error(`Error al cargar usuarios (${usersResponse.status})`);
      const usersData = await usersResponse.json();
      setUsers(Array.isArray(usersData) ? usersData : usersData.items || []);

      if (analyticsResponse.ok) {
        setAnalytics(await analyticsResponse.json());
      }

      const [boatsResponse, tablesResponse] = await Promise.all([
        authFetch(`${apiUrl}/api/v1/context/embarcaciones`),
        authFetch(`${apiUrl}/api/v1/context/tablillas`),
      ]);
      if (boatsResponse.ok) setBoats(await boatsResponse.json());
      if (tablesResponse.ok) setTables(await tablesResponse.json());
    } catch (error: any) {
      onNotify(error.message || 'No se pudieron cargar los usuarios', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [apiUrl]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter(user => {
      const matchesText =
        !term ||
        user.username.toLowerCase().includes(term) ||
        user.nombre_completo.toLowerCase().includes(term) ||
        String(user.id_usuario).includes(term);
      const matchesRole = !roleFilter || String(user.rol).toLowerCase() === roleFilter;
      const matchesStatus =
        !statusFilter ||
        (statusFilter === 'activo' && user.activo) ||
        (statusFilter === 'inactivo' && !user.activo);
      return matchesText && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const roleMax = Math.max(...(analytics.roles || []).map(item => Number(item.total || 0)), 1);
  const activeBoats = boats.filter(boat => String(boat.estado || 'ACTIVA').toUpperCase() === 'ACTIVA').length;
  const activeTables = tables.filter(table => String(table.estado || 'ACTIVA').toUpperCase() === 'ACTIVA').length;
  const availableTables = tables.filter(table => !table.fk_embarcacion && String(table.estado || 'ACTIVA').toUpperCase() === 'ACTIVA');

  const sectionMeta = {
    users: {
      title: 'Administración de usuarios',
      subtitle: 'Crea, edita y audita accesos para administradores, supervisores y buzos.',
    },
    boats: {
      title: 'Administración de embarcaciones',
      subtitle: 'Crea embarcaciones y mantenlas disponibles para asignar buzos y tablas.',
    },
    tables: {
      title: 'Tablas asignadas',
      subtitle: 'Asocia IDs de tabla entregados por Claude Vision a una embarcación.',
    },
  }[activeSection];

  const openCreate = () => {
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (user: AdminUser) => {
    setForm({
      id_usuario: user.id_usuario,
      username: user.username,
      nombre_completo: user.nombre_completo,
      password: '',
      rol: String(user.rol).toLowerCase() as UserRole,
      activo: Boolean(user.activo),
      fk_embarcacion: user.fk_embarcacion || '',
      id_tablilla: user.id_tablilla || '',
    });
    setFormOpen(true);
  };

  const saveUser = async () => {
    if (!currentUser || currentUser.role !== 'admin') {
      onNotify('No tienes permisos para administrar usuarios', 'error');
      return;
    }
    if (!form.username.trim() || !form.nombre_completo.trim()) {
      onNotify('Completa usuario y nombre completo', 'error');
      return;
    }
    if (!isEditing && form.password.trim().length < 6) {
      onNotify('La password temporal debe tener al menos 6 caracteres', 'error');
      return;
    }
    if (isEditing && form.password && form.password.trim().length < 6) {
      onNotify('La nueva password debe tener al menos 6 caracteres', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {
        username: form.username.trim(),
        nombre_completo: form.nombre_completo.trim(),
        rol: form.rol,
        activo: form.activo,
        fk_embarcacion: form.fk_embarcacion || null,
        id_tablilla: form.id_tablilla?.trim() || null,
      };
      if (form.password.trim()) payload.password = form.password.trim();

      const response = await authFetch(
        isEditing ? `${apiUrl}/api/v1/users/${form.id_usuario}` : `${apiUrl}/api/v1/users`,
        {
          method: isEditing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail || `Error al ${isEditing ? 'actualizar' : 'crear'} usuario`);
      }

      onNotify(isEditing ? 'Usuario actualizado correctamente' : 'Usuario creado correctamente', 'success');
      setFormOpen(false);
      setForm(emptyForm);
      fetchData(true);
    } catch (error: any) {
      onNotify(error.message || 'No se pudo guardar el usuario', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const saveBoat = async () => {
    if (!boatForm.matricula.trim() || !boatForm.nombre_nave.trim()) {
      onNotify('Completa matrícula y nombre de nave', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const response = await authFetch(`${apiUrl}/api/v1/context/embarcaciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matricula: boatForm.matricula.trim(),
          nombre_nave: boatForm.nombre_nave.trim(),
          capacidad_personas: Number(boatForm.capacidad_personas) || 0,
          estado: 'ACTIVA',
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail || 'No se pudo crear la embarcación');
      }
      onNotify('Embarcación creada correctamente', 'success');
      setBoatForm(emptyBoatForm);
      setBoatFormOpen(false);
      fetchData(true);
    } catch (error: any) {
      onNotify(error.message || 'No se pudo crear la embarcación', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const saveTable = async () => {
    if (!tableForm.id_tablilla && !tableForm.codigo_tablilla.trim()) {
      onNotify('Completa el ID de tabla Claude', 'error');
      return;
    }
    if (tableForm.id_tablilla && !tableForm.fk_embarcacion) {
      onNotify('Selecciona una embarcación para asociar la tabla', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const isAssigningExisting = Boolean(tableForm.id_tablilla);
      const response = await authFetch(
        isAssigningExisting
          ? `${apiUrl}/api/v1/context/tablillas/${tableForm.id_tablilla}`
          : `${apiUrl}/api/v1/context/tablillas`,
        {
        method: isAssigningExisting ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo_tablilla: tableForm.codigo_tablilla.trim(),
          fk_embarcacion: tableForm.fk_embarcacion ? Number(tableForm.fk_embarcacion) : null,
          nombre_referencia: tableForm.nombre_referencia.trim() || null,
          descripcion: tableForm.descripcion.trim() || null,
          estado: tableForm.estado,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail || 'No se pudo crear la tabla');
      }
      onNotify(isAssigningExisting ? 'Tabla asociada correctamente' : 'Tabla creada correctamente', 'success');
      setTableForm(emptyTableForm);
      setTableFormOpen(false);
      fetchData(true);
    } catch (error: any) {
      onNotify(error.message || 'No se pudo crear la tabla', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (user: AdminUser) => {
    try {
      const response = await authFetch(`${apiUrl}/api/v1/users/${user.id_usuario}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !user.activo }),
      });
      if (!response.ok) throw new Error(`No se pudo ${user.activo ? 'desactivar' : 'activar'} el usuario`);
      onNotify(user.activo ? 'Usuario desactivado' : 'Usuario activado', 'success');
      fetchData(true);
    } catch (error: any) {
      onNotify(error.message || 'No se pudo actualizar el estado', 'error');
    }
  };

  const deleteUser = async () => {
    if (!confirmDelete) return;
    try {
      const response = await authFetch(`${apiUrl}/api/v1/users/${confirmDelete.id_usuario}?hard=true`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail || 'No se pudo eliminar el usuario');
      }
      onNotify('Usuario eliminado correctamente', 'success');
      setConfirmDelete(null);
      fetchData(true);
    } catch (error: any) {
      onNotify(error.message || 'No se pudo eliminar el usuario', 'error');
    }
  };

  return (
    <div className="h-full w-full overflow-y-auto bg-[#f6f8fb] px-4 py-4 dark:bg-[#0a0a0a] md:px-5">
      <div className="mx-auto flex max-w-[1480px] animate-in fade-in slide-in-from-bottom-3 duration-500 flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-1.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400 dark:text-zinc-500">
              <UserCog className="h-4 w-4" />
              Control de acceso
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-950 dark:text-white md:text-3xl">
              {sectionMeta.title}
            </h2>
            <p className="mt-1 max-w-2xl text-sm font-medium text-gray-500 dark:text-zinc-400">
              {sectionMeta.subtitle}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => fetchData(true)}>
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </Button>
            {activeSection === 'users' && <Button size="sm" onClick={openCreate}>
              <UserPlus className="h-4 w-4" />
              Crear usuario
            </Button>}
            {activeSection === 'boats' && <Button size="sm" onClick={() => setBoatFormOpen(true)}>
              <Ship className="h-4 w-4" />
              Crear embarcación
            </Button>}
            {activeSection === 'tables' && <Button size="sm" onClick={() => { setTableForm(emptyTableForm); setTableFormOpen(true); }}>
              <Table2 className="h-4 w-4" />
              Crear tabla
            </Button>}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { id: 'users' as const, label: 'Usuarios', icon: Users },
            { id: 'boats' as const, label: 'Embarcaciones', icon: Ship },
            { id: 'tables' as const, label: 'Tablas asignadas', icon: Table2 },
          ].map(item => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSectionChange?.(item.id)}
                className={`flex h-10 items-center gap-2 border px-3 text-sm font-bold transition-colors ${
                  active
                    ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-black hover:text-black dark:border-zinc-800 dark:bg-[#111113] dark:text-zinc-400 dark:hover:border-white dark:hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-500 dark:text-zinc-400">
                  {activeSection === 'users' ? 'Usuarios activos' : 'Embarcaciones activas'}
                </p>
                <p className="mt-1 text-3xl font-semibold text-black dark:text-white">
                  {activeSection === 'users' ? (analytics.summary?.activos || 0) : activeBoats}
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-300">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-500 dark:text-zinc-400">
                  {activeSection === 'users' ? 'Usuarios totales' : 'Tablas activas'}
                </p>
                <p className="mt-1 text-3xl font-semibold text-black dark:text-white">
                  {activeSection === 'users' ? (analytics.summary?.total || users.length) : activeTables}
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                <Users className="h-5 w-5" />
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-500 dark:text-zinc-400">Con último acceso</p>
                <p className="mt-1 text-3xl font-semibold text-black dark:text-white">{analytics.summary?.con_login || 0}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center bg-gray-100 text-gray-600 dark:bg-zinc-900 dark:text-zinc-300">
                <Activity className="h-5 w-5" />
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div>
              <p className="text-xs font-bold text-gray-500 dark:text-zinc-400">Último acceso</p>
              <p className="mt-2 line-clamp-2 text-sm font-semibold text-black dark:text-white">
                {analytics.summary?.ultimo_login ? formatChileDateTime(analytics.summary.ultimo_login) : 'Sin accesos registrados'}
              </p>
            </div>
          </Card>
        </div>

        {activeSection === 'users' && <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-gray-200 p-3 dark:border-zinc-800 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    placeholder="Buscar por ID, usuario o nombre"
                    className={`${inputClass} pl-9`}
                  />
                </div>
                <SelectControl className="w-full sm:w-48" value={roleFilter} onChange={setRoleFilter} options={roleOptions} />
                <SelectControl className="w-full sm:w-48" value={statusFilter} onChange={setStatusFilter} options={statusOptions} />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[840px] text-left">
                <thead className="border-b border-gray-200 bg-white text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:border-zinc-800 dark:bg-[#111113] dark:text-zinc-400">
                  <tr>
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Usuario</th>
                    <th className="px-4 py-3">Rol</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Último login</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-zinc-900">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center text-sm font-semibold text-gray-400">
                        <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
                        Sincronizando usuarios
                      </td>
                    </tr>
                  ) : filteredUsers.length ? (
                    filteredUsers.map(user => (
                      <tr key={user.id_usuario} className="hover:bg-gray-50 dark:hover:bg-zinc-900/50">
                        <td className="px-4 py-3 text-sm font-semibold text-gray-500">#{user.id_usuario}</td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-bold text-black dark:text-white">{user.nombre_completo}</p>
                          <p className="text-xs font-medium text-gray-500 dark:text-zinc-400">{user.username}</p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={roleTone(String(user.rol))}>{roleLabel(String(user.rol))}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={user.activo ? 'success' : 'muted'}>{user.activo ? 'Activo' : 'Inactivo'}</Badge>
                        </td>
                        <td className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-zinc-400">
                          {user.last_login_at ? formatChileDateTime(user.last_login_at) : 'Sin login'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(user)} title="Editar">
                              <Edit3 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => toggleActive(user)} title={user.activo ? 'Desactivar' : 'Activar'}>
                              <Shield className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(user)} title="Eliminar">
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-16 text-center text-sm font-semibold text-gray-400">
                        No hay usuarios para los filtros seleccionados
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="flex flex-col gap-3">
            <Card className="p-4">
              <h3 className="mb-4 text-sm font-bold text-black dark:text-white">Distribución por rol</h3>
              <div className="space-y-3">
                {(analytics.roles || []).map(item => (
                  <div key={item.rol}>
                    <div className="mb-1 flex items-center justify-between text-xs font-semibold text-gray-500">
                      <span>{roleLabel(item.rol)}</span>
                      <span>{item.total}</span>
                    </div>
                    <div className="h-2 bg-gray-100 dark:bg-zinc-900">
                      <div className="h-full bg-blue-600" style={{ width: `${(Number(item.total || 0) / roleMax) * 100}%` }} />
                    </div>
                  </div>
                ))}
                {!(analytics.roles || []).length && <p className="text-sm text-gray-400">Sin roles registrados.</p>}
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="mb-4 text-sm font-bold text-black dark:text-white">Actividad por usuario</h3>
              <div className="space-y-3">
                {(analytics.activity || []).map(item => (
                  <div key={item.usuario} className="flex items-center justify-between gap-3 text-xs">
                    <span className="min-w-0 truncate font-semibold text-gray-700 dark:text-zinc-300">{item.usuario}</span>
                    <span className="shrink-0 text-gray-500">{item.digitalizaciones} dig. / {item.validadas} val.</span>
                  </div>
                ))}
                {!(analytics.activity || []).length && <p className="text-sm text-gray-400">Sin actividad registrada.</p>}
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="mb-4 text-sm font-bold text-black dark:text-white">Auditoría reciente</h3>
              <div className="space-y-3">
                {(analytics.audit || []).map((item, index) => (
                  <div key={`${item.accion}-${item.entidad_id}-${index}`} className="border-l-2 border-blue-500 pl-3">
                    <p className="text-xs font-bold text-black dark:text-white">{actionLabel(item.accion)}</p>
                    <p className="text-[11px] text-gray-500 dark:text-zinc-400">
                      {item.username} · ID {item.entidad_id} · {formatChileDateTime(item.created_at)}
                    </p>
                  </div>
                ))}
                {!(analytics.audit || []).length && <p className="text-sm text-gray-400">Sin eventos de auditoría.</p>}
              </div>
            </Card>
          </div>
        </div>}

        {activeSection === 'boats' && (
          <Card className="overflow-hidden">
            <div className="border-b border-gray-200 p-3 dark:border-zinc-800">
              <h3 className="text-sm font-bold text-black dark:text-white">Embarcaciones</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-left">
                <thead className="border-b border-gray-200 bg-white text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:border-zinc-800 dark:bg-[#111113] dark:text-zinc-400">
                  <tr>
                    <th className="px-4 py-3">Matrícula</th>
                    <th className="px-4 py-3">Nombre nave</th>
                    <th className="px-4 py-3">Capacidad</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Tablas asociadas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-zinc-900">
                  {boats.map(boat => (
                    <tr key={boat.id} className="hover:bg-gray-50 dark:hover:bg-zinc-900/50">
                      <td className="px-4 py-3 font-mono text-xs font-bold text-gray-700 dark:text-zinc-300">{boat.matricula}</td>
                      <td className="px-4 py-3 text-sm font-bold text-black dark:text-white">{boat.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{boat.capacidad_personas || 0}</td>
                      <td className="px-4 py-3"><Badge tone={boat.estado === 'ACTIVA' ? 'success' : 'muted'}>{boat.estado || 'ACTIVA'}</Badge></td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-600 dark:text-zinc-300">{boat.tablas_asociadas || 0}</td>
                    </tr>
                  ))}
                  {!boats.length && (
                    <tr><td colSpan={5} className="py-16 text-center text-sm font-semibold text-gray-400">Sin embarcaciones registradas</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {activeSection === 'tables' && (
          <Card className="overflow-hidden">
            <div className="border-b border-gray-200 p-3 dark:border-zinc-800">
              <h3 className="text-sm font-bold text-black dark:text-white">Tablas asociadas a embarcaciones</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left">
                <thead className="border-b border-gray-200 bg-white text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:border-zinc-800 dark:bg-[#111113] dark:text-zinc-400">
                  <tr>
                    <th className="px-4 py-3">ID tabla Claude</th>
                    <th className="px-4 py-3">Embarcación</th>
                    <th className="px-4 py-3">Referencia</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Origen</th>
                    <th className="px-4 py-3">Actualizada</th>
                    <th className="px-4 py-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-zinc-900">
                  {tables.map(table => (
                    <tr key={table.id} className="hover:bg-gray-50 dark:hover:bg-zinc-900/50">
                      <td className="px-4 py-3 font-mono text-xs font-bold text-blue-700 dark:text-blue-300">{table.codigo_tablilla}</td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-bold text-black dark:text-white">{table.embarcacion || 'Disponible'}</p>
                        <p className="text-xs text-gray-500">{table.matricula || 'Sin embarcación'}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-zinc-300">{table.nombre_referencia || '-'}</td>
                      <td className="px-4 py-3"><Badge tone={table.estado === 'ACTIVA' ? 'success' : 'muted'}>{table.estado || 'ACTIVA'}</Badge></td>
                      <td className="px-4 py-3 text-xs text-gray-500">{table.origen || 'ADMIN_PANEL'}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{table.updated_at ? formatChileDateTime(table.updated_at) : '-'}</td>
                      <td className="px-4 py-3 text-right">
                        {!table.fk_embarcacion && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setTableForm({
                                id_tablilla: String(table.id),
                                codigo_tablilla: table.codigo_tablilla,
                                fk_embarcacion: '',
                                nombre_referencia: table.nombre_referencia || '',
                                descripcion: table.descripcion || '',
                                estado: table.estado || 'ACTIVA',
                              });
                              setTableFormOpen(true);
                            }}
                          >
                            Asociar
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!tables.length && (
                    <tr><td colSpan={7} className="py-16 text-center text-sm font-semibold text-gray-400">Sin tablas disponibles en la BDD</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-[3000] flex justify-end bg-black/40">
          <div className="flex h-full w-full max-w-md flex-col border-l border-gray-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-[#0b0b0c]">
            <div className="flex items-start justify-between border-b border-gray-100 p-4 dark:border-zinc-900">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">
                  {isEditing ? 'Editar acceso' : 'Nuevo acceso'}
                </p>
                <h3 className="mt-1 text-xl font-bold text-black dark:text-white">
                  {isEditing ? 'Editar usuario' : 'Crear usuario'}
                </h3>
              </div>
              <button onClick={() => setFormOpen(false)} className="flex h-9 w-9 items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-black dark:hover:bg-zinc-900 dark:hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-gray-400">Correo</label>
                <input value={form.username} onChange={event => setForm({ ...form, username: event.target.value })} className={inputClass} placeholder="ej: buzo@bluegrid.cl" />
              </div>
              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-gray-400">Nombre completo</label>
                <input value={form.nombre_completo} onChange={event => setForm({ ...form, nombre_completo: event.target.value })} className={inputClass} placeholder="Nombre y apellido" />
              </div>
              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-gray-400">Rol</label>
                <SelectControl value={form.rol} onChange={value => setForm({ ...form, rol: value as UserRole })} options={formRoleOptions} />
              </div>
              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-gray-400">
                  {isEditing ? 'Nueva contraseña opcional' : 'Contraseña temporal'}
                </label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="password"
                    value={form.password}
                    onChange={event => setForm({ ...form, password: event.target.value })}
                    className={`${inputClass} pl-9`}
                    placeholder={isEditing ? 'Dejar en blanco para mantener' : 'Mínimo 6 caracteres'}
                  />
                </div>
              </div>
              <label className="flex items-center justify-between border border-gray-200 p-3 text-sm font-semibold text-gray-600 dark:border-zinc-800 dark:text-zinc-300">
                Usuario activo
                <input
                  type="checkbox"
                  checked={form.activo}
                  onChange={event => setForm({ ...form, activo: event.target.checked })}
                  className="h-4 w-4 accent-blue-600"
                />
              </label>
              {form.rol === 'buzo' && (
                <div className="space-y-4 border border-blue-100 bg-blue-50/60 p-3 dark:border-blue-900/40 dark:bg-blue-950/10">
                  <div>
                    <label className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-blue-600 dark:text-blue-300">Embarcación asignada</label>
                    <SelectControl
                      value={form.fk_embarcacion ? String(form.fk_embarcacion) : ''}
                      onChange={value => setForm({ ...form, fk_embarcacion: value ? Number(value) : '' })}
                      options={[
                        { value: '', label: 'Sin embarcación' },
                        ...boats.map(boat => ({ value: String(boat.id), label: `${boat.name} · ${boat.matricula}` })),
                      ]}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-blue-600 dark:text-blue-300">ID tabla asignada</label>
                    <input
                      value={form.id_tablilla || ''}
                      onChange={event => setForm({ ...form, id_tablilla: event.target.value })}
                      className={inputClass}
                      placeholder="Ej: TAB-021"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 border-t border-gray-100 p-4 dark:border-zinc-900">
              <Button variant="outline" className="flex-1" onClick={() => setFormOpen(false)} disabled={isSaving}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={saveUser} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Guardar
              </Button>
            </div>
          </div>
        </div>
      )}

      {boatFormOpen && (
        <div className="fixed inset-0 z-[3000] flex justify-end bg-black/40">
          <div className="flex h-full w-full max-w-md flex-col border-l border-gray-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-[#0b0b0c]">
            <div className="flex items-start justify-between border-b border-gray-100 p-4 dark:border-zinc-900">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">Nueva embarcación</p>
                <h3 className="mt-1 text-xl font-bold text-black dark:text-white">Crear embarcación</h3>
              </div>
              <button onClick={() => setBoatFormOpen(false)} className="flex h-9 w-9 items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-black dark:hover:bg-zinc-900 dark:hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-gray-400">Matrícula</label>
                <input
                  value={boatForm.matricula}
                  onChange={event => setBoatForm({ ...boatForm, matricula: event.target.value })}
                  className={`${inputClass} uppercase`}
                  placeholder="Ej: PM-3056"
                />
              </div>
              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-gray-400">Nombre nave</label>
                <input
                  value={boatForm.nombre_nave}
                  onChange={event => setBoatForm({ ...boatForm, nombre_nave: event.target.value })}
                  className={inputClass}
                  placeholder="Nombre de la embarcación"
                />
              </div>
              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-gray-400">Capacidad</label>
                <input
                  type="number"
                  min={0}
                  value={boatForm.capacidad_personas}
                  onChange={event => setBoatForm({ ...boatForm, capacidad_personas: Number(event.target.value) })}
                  className={inputClass}
                />
              </div>
              <div className="border border-gray-200 bg-gray-50 p-3 text-sm leading-6 text-gray-500 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-400">
                Al guardar, la embarcación quedará disponible para asignar buzos y asociar IDs de tabla detectados por Claude Vision.
              </div>
            </div>

            <div className="flex gap-2 border-t border-gray-100 p-4 dark:border-zinc-900">
              <Button variant="outline" className="flex-1" onClick={() => setBoatFormOpen(false)} disabled={isSaving}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={saveBoat} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ship className="h-4 w-4" />}
                Guardar
              </Button>
            </div>
          </div>
        </div>
      )}

      {tableFormOpen && (
        <div className="fixed inset-0 z-[3000] flex justify-end bg-black/40">
          <div className="flex h-full w-full max-w-md flex-col border-l border-gray-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-[#0b0b0c]">
            <div className="flex items-start justify-between border-b border-gray-100 p-4 dark:border-zinc-900">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">Tabla Claude Vision</p>
                <h3 className="mt-1 text-xl font-bold text-black dark:text-white">Asociar tabla</h3>
              </div>
              <button onClick={() => setTableFormOpen(false)} className="flex h-9 w-9 items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-black dark:hover:bg-zinc-900 dark:hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-gray-400">Tabla disponible en BDD</label>
                <SelectControl
                  value={tableForm.id_tablilla}
                  onChange={value => {
                    const selected = availableTables.find(table => String(table.id) === value);
                    setTableForm({
                      ...tableForm,
                      id_tablilla: value,
                      codigo_tablilla: selected?.codigo_tablilla || '',
                      nombre_referencia: selected?.nombre_referencia || '',
                      descripcion: selected?.descripcion || '',
                      estado: selected?.estado || 'ACTIVA',
                    });
                  }}
                  options={[
                    { value: '', label: availableTables.length ? 'Crear nueva tabla' : 'Crear nueva tabla (no hay disponibles)' },
                    ...availableTables.map(table => ({ value: String(table.id), label: table.codigo_tablilla })),
                  ]}
                />
              </div>
              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-gray-400">ID tabla Claude</label>
                <input
                  value={tableForm.codigo_tablilla}
                  onChange={event => setTableForm({ ...tableForm, codigo_tablilla: event.target.value })}
                  className={`${inputClass} uppercase`}
                  placeholder="Ej: TAB-021"
                  readOnly={Boolean(tableForm.id_tablilla)}
                />
              </div>
              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-gray-400">Embarcación</label>
                <SelectControl
                  value={tableForm.fk_embarcacion}
                  onChange={value => setTableForm({ ...tableForm, fk_embarcacion: value })}
                  options={[
                    { value: '', label: 'Seleccionar embarcación' },
                    ...boats.map(boat => ({ value: String(boat.id), label: `${boat.name} · ${boat.matricula}` })),
                  ]}
                />
              </div>
              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-gray-400">Referencia</label>
                <input
                  value={tableForm.nombre_referencia}
                  onChange={event => setTableForm({ ...tableForm, nombre_referencia: event.target.value })}
                  className={inputClass}
                  placeholder="Ej: Tabla operativa cubierta norte"
                />
              </div>
              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-gray-400">Estado</label>
                <SelectControl
                  value={tableForm.estado}
                  onChange={value => setTableForm({ ...tableForm, estado: value })}
                  options={boatStatusOptions}
                />
              </div>
              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-gray-400">Descripción</label>
                <textarea
                  value={tableForm.descripcion}
                  onChange={event => setTableForm({ ...tableForm, descripcion: event.target.value })}
                  rows={4}
                  className="w-full resize-none border border-gray-200 bg-white p-3 text-sm font-medium text-black outline-none transition-colors placeholder:text-gray-400 focus:border-blue-500 dark:border-zinc-800 dark:bg-[#050505] dark:text-white dark:focus:border-blue-400"
                  placeholder="Notas opcionales para administración y contexto futuro."
                />
              </div>
            </div>

            <div className="flex gap-2 border-t border-gray-100 p-4 dark:border-zinc-900">
              <Button variant="outline" className="flex-1" onClick={() => setTableFormOpen(false)} disabled={isSaving}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={saveTable} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Table2 className="h-4 w-4" />}
                Guardar
              </Button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-[3100] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md border border-gray-200 bg-white p-4 shadow-2xl dark:border-zinc-800 dark:bg-[#0b0b0c]">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-red-500">Eliminar usuario</p>
            <h3 className="mt-1 text-lg font-bold text-black dark:text-white">{confirmDelete.nombre_completo}</h3>
            <p className="mt-3 text-sm leading-6 text-gray-500 dark:text-zinc-400">
              Se intentará eliminar definitivamente. Si tiene registros OCR asociados, el backend bloqueará la eliminación para proteger la trazabilidad y podrás desactivarlo.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)}>
                Cancelar
              </Button>
              <Button variant="danger" size="sm" onClick={deleteUser}>
                <Trash2 className="h-4 w-4" />
                Eliminar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
