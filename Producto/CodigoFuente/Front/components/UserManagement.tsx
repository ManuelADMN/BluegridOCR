import React, { useState, useEffect } from 'react';
import { 
  Users, UserPlus, Trash2, Shield, User, Loader2, 
  AlertCircle, CheckCircle2, X, Mail, Fingerprint, 
  Anchor, Clipboard, KeyRound, Search, Filter,
  Ship, Info, PlusCircle
} from 'lucide-react';
import { UserRole } from '../types';
import { authFetch } from '../services/apiClient';
import { SelectControl } from './ui/form-controls';

interface BackendUser {
  id_usuario: number;
  rut: string;
  correo: string;
  nombre_completo: string;
  fk_rol: number;
  rol_nombre?: string;
  fk_embarcacion?: number;
  id_tablilla?: string;
  activo: boolean;
}

interface Embarcacion {
  id: number;
  name: string;
  matricula: string;
  capacidad_personas?: number;
  estado?: string;
}

interface UserManagementProps {
  apiUrl: string;
  requesterRole: UserRole;
}

export default function UserManagement({ apiUrl, requesterRole }: UserManagementProps) {
  const [users, setUsers] = useState<BackendUser[]>([]);
  const [embarcaciones, setEmbarcaciones] = useState<Embarcacion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isAddingBoat, setIsAddingBoat] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // New user form state
  const [newRut, setNewRut] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<number>(3); // Default to buzo
  const [newEmbarcacion, setNewEmbarcacion] = useState<number | ''>('');
  const [newTablilla, setNewTablilla] = useState('');
  const [newBoatMatricula, setNewBoatMatricula] = useState('');
  const [newBoatName, setNewBoatName] = useState('');
  const [newBoatCapacity, setNewBoatCapacity] = useState(0);

  const fetchUsers = async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const [uRes, eRes] = await Promise.all([
        authFetch(`${apiUrl}/api/v1/users`),
        authFetch(`${apiUrl}/api/v1/context/embarcaciones`)
      ]);

      if (!uRes.ok) throw new Error('No se pudieron cargar los usuarios');
      
      const uData = await uRes.json();
      setUsers(Array.isArray(uData) ? uData : (uData.items || []));

      if (eRes.ok) {
        const eData = await eRes.json();
        setEmbarcaciones(eData);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleAddBoat = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const response = await authFetch(`${apiUrl}/api/v1/context/embarcaciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matricula: newBoatMatricula,
          nombre_nave: newBoatName,
          capacidad_personas: Number(newBoatCapacity) || 0,
          estado: 'ACTIVA',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Error al crear embarcacion');
      }

      const created = await response.json();
      setNewBoatMatricula('');
      setNewBoatName('');
      setNewBoatCapacity(0);
      setIsAddingBoat(false);
      setNewEmbarcacion(created.id);
      fetchUsers(true);
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    fetchUsers();
    const interval = setInterval(() => fetchUsers(true), 60000);
    return () => clearInterval(interval);
  }, [apiUrl]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.trim().length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    // Buzo (fk_rol 3) requires embarcación
    if (newRole === 3 && !newEmbarcacion) {
      setError('Los buzos deben tener una embarcación asignada');
      return;
    }

    try {
      const response = await authFetch(`${apiUrl}/api/v1/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rut: newRut,
          correo: newEmail,
          nombre_completo: newName,
          password: newPassword,
          fk_rol: newRole,
          fk_embarcacion: newEmbarcacion || null,
          id_tablilla: newTablilla || null
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Error al crear usuario');
      }

      // Reset form
      setNewRut('');
      setNewEmail('');
      setNewName('');
      setNewPassword('');
      setNewRole(3);
      setNewEmbarcacion('');
      setNewTablilla('');
      setIsAdding(false);
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('¿Estás seguro de eliminar este usuario?')) return;
    try {
      const response = await authFetch(`${apiUrl}/api/v1/users/${userId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('No se pudo eliminar el usuario');
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const filteredUsers = users.filter(u => 
    u.nombre_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.correo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.rut.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleBadge = (roleName: string | undefined) => {
    const role = roleName?.toLowerCase();
    if (role?.includes('admin')) 
      return <span className="px-2 py-1 rounded-md bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5"><Shield className="w-3 h-3" /> Admin</span>;
    if (role?.includes('supervisor')) 
      return <span className="px-2 py-1 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5"><Anchor className="w-3 h-3" /> Supervisor</span>;
    return <span className="px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5"><User className="w-3 h-3" /> Buzo</span>;
  };

  return (
    <div className="p-6 md:p-10 space-y-8 animate-in fade-in duration-500 max-w-6xl mx-auto h-full flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 shrink-0">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-black tracking-tighter text-black dark:text-white">Usuarios</h2>
            <div className="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[10px] font-bold text-zinc-500">
              {users.length} TOTAL
            </div>
            {isRefreshing && <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />}
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">Panel de administración de acceso y roles.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-black dark:group-focus-within:text-white transition-colors" />
            <input 
              type="text" 
              placeholder="Buscar por nombre, RUT o correo..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 h-11 w-64 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 text-sm focus:outline-none focus:border-black dark:focus:border-white transition-all"
            />
          </div>
          <button
            onClick={() => setIsAddingBoat(true)}
            className="flex items-center justify-center gap-2 bg-white dark:bg-zinc-900 text-black dark:text-white border border-zinc-200 dark:border-zinc-800 px-5 h-11 rounded-xl font-bold text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all active:scale-95 whitespace-nowrap"
          >
            <PlusCircle className="w-4 h-4" /> EMBARCACION
          </button>
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center justify-center gap-2 bg-black dark:bg-white text-white dark:text-black px-6 h-11 rounded-xl font-bold text-sm hover:opacity-90 transition-all shadow-lg active:scale-95 whitespace-nowrap"
          >
            <UserPlus className="w-4 h-4" /> REGISTRAR
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top-2 shrink-0">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-semibold">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-full"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="flex-1 min-h-0 bg-white dark:bg-[#050505] rounded-[2.5rem] border border-zinc-100 dark:border-zinc-900 overflow-hidden shadow-sm flex flex-col">
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div className="relative">
              <Loader2 className="w-12 h-12 animate-spin text-zinc-200 dark:text-zinc-800" />
              <Users className="absolute inset-0 m-auto w-5 h-5 text-zinc-400" />
            </div>
            <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Sincronizando...</p>
          </div>
        ) : (
          <div className="overflow-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-white/80 dark:bg-[#050505]/80 backdrop-blur-md z-10 border-b border-zinc-100 dark:border-zinc-900">
                <tr>
                  <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Identificación</th>
                  <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Nombre Completo</th>
                  <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Rol</th>
                  <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Asignación</th>
                  <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-zinc-400 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-900">
                {filteredUsers.length > 0 ? filteredUsers.map((u) => (
                  <tr key={u.id_usuario} className="group hover:bg-zinc-50/50 dark:hover:bg-zinc-900/20 transition-all">
                    <td className="px-8 py-5">
                      <div className="space-y-1">
                        <div className="text-sm font-bold text-black dark:text-white flex items-center gap-2">
                          <Fingerprint className="w-3.5 h-3.5 text-zinc-400" /> {u.rut}
                        </div>
                        <div className="text-[11px] text-zinc-500 font-medium flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5 text-zinc-400" /> {u.correo}
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                      {u.nombre_completo}
                    </td>
                    <td className="px-8 py-5">
                      {getRoleBadge(u.rol_nombre)}
                    </td>
                    <td className="px-8 py-5">
                      {u.fk_rol === 3 ? (
                        <div className="space-y-1">
                          <div className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
                            <Ship className="w-3.5 h-3.5" /> {embarcaciones.find(e => e.id === u.fk_embarcacion)?.name || 'Sin barco'}
                          </div>
                          {u.id_tablilla && (
                            <div className="text-[10px] text-zinc-400 font-mono bg-zinc-50 dark:bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-100 dark:border-zinc-800 inline-block">
                              ID: {u.id_tablilla}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] text-zinc-300 dark:text-zinc-700 font-bold uppercase tracking-widest">—</span>
                      )}
                    </td>
                    <td className="px-8 py-5 text-right">
                      <button
                        onClick={() => handleDeleteUser(u.id_usuario)}
                        className="p-2.5 text-zinc-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                        title="Eliminar usuario"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Users className="w-10 h-10 text-zinc-200 dark:text-zinc-800" />
                        <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest">No se encontraron resultados</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Añadir Usuario - Refactorizado a Premium */}
      {isAdding && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-[#0a0a0a] w-full max-w-2xl rounded-[3rem] shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-10">
              <div className="flex items-center justify-between mb-10">
                <div className="space-y-1">
                  <h3 className="text-3xl font-black tracking-tighter text-black dark:text-white">Registrar Usuario</h3>
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Complete los datos del nuevo integrante</p>
                </div>
                <button onClick={() => setIsAdding(false)} className="p-3 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-2xl transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddUser} className="space-y-8">
                <div className="grid grid-cols-2 gap-6">
                  {/* Datos Identificación */}
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-1">RUT (ID Personal)</label>
                      <div className="relative">
                        <Fingerprint className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                        <input
                          required
                          type="text"
                          value={newRut}
                          onChange={e => setNewRut(e.target.value)}
                          placeholder="12.345.678-9"
                          className="w-full h-12 pl-12 pr-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm focus:outline-none focus:border-black dark:focus:border-white transition-all font-medium"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-1">Correo Electrónico</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                        <input
                          required
                          type="email"
                          value={newEmail}
                          onChange={e => setNewEmail(e.target.value)}
                          placeholder="usuario@bluegrid.cl"
                          className="w-full h-12 pl-12 pr-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm focus:outline-none focus:border-black dark:focus:border-white transition-all font-medium"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-1">Contraseña de Acceso</label>
                      <div className="relative">
                        <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                        <input
                          required
                          minLength={6}
                          type="password"
                          value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                          placeholder="Mínimo 6 caracteres"
                          className="w-full h-12 pl-12 pr-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm focus:outline-none focus:border-black dark:focus:border-white transition-all font-medium"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Datos Perfil y Rol */}
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-1">Nombre Completo</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                        <input
                          required
                          type="text"
                          value={newName}
                          onChange={e => setNewName(e.target.value)}
                          placeholder="Nombre y Apellido"
                          className="w-full h-12 pl-12 pr-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm focus:outline-none focus:border-black dark:focus:border-white transition-all font-medium"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-1">Rol Operativo</label>
                      <div className="relative">
                        <Shield className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                        <SelectControl
                          value={String(newRole)}
                          onChange={value => setNewRole(Number(value))}
                          options={[
                            { value: '1', label: 'Administrador' },
                            { value: '2', label: 'Supervisor' },
                            { value: '3', label: 'Buzo (operador)' },
                          ]}
                          buttonClassName="h-12 rounded-2xl bg-zinc-50 pl-12 font-bold dark:bg-zinc-900"
                        />
                      </div>
                    </div>

                    {/* Campos específicos para Buzo */}
                    {newRole === 3 && (
                      <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest px-1">Barco</label>
                          <SelectControl
                            value={newEmbarcacion ? String(newEmbarcacion) : ''}
                            onChange={value => setNewEmbarcacion(Number(value))}
                            options={[
                              { value: '', label: 'Seleccionar...' },
                              ...embarcaciones.map(e => ({ value: String(e.id), label: e.name })),
                            ]}
                            buttonClassName="h-12 rounded-2xl border-blue-200 bg-blue-50 text-xs font-bold dark:border-blue-900/30 dark:bg-blue-900/10"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest px-1">ID Tablilla</label>
                          <input
                            type="text"
                            value={newTablilla}
                            onChange={e => setNewTablilla(e.target.value)}
                            placeholder="TAB-00"
                            className="w-full h-12 px-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30 rounded-2xl text-xs font-bold focus:outline-none focus:border-blue-500 transition-all placeholder:text-blue-300"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-6 flex gap-4">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="flex-1 h-14 bg-zinc-100 dark:bg-zinc-900 text-black dark:text-white font-bold rounded-2xl hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all text-xs tracking-widest"
                  >
                    DESCARTAR
                  </button>
                  <button
                    type="submit"
                    className="flex-[2] h-14 bg-black dark:bg-white text-white dark:text-black font-black rounded-2xl hover:opacity-90 transition-all text-xs tracking-[0.2em] shadow-xl shadow-black/10 dark:shadow-white/5 active:scale-[0.98]"
                  >
                    CREAR USUARIO
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {isAddingBoat && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-[#0a0a0a] w-full max-w-lg rounded-[2rem] shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="space-y-1">
                  <h3 className="text-2xl font-black tracking-tighter text-black dark:text-white">Registrar Embarcacion</h3>
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Disponible para asignar a buzos</p>
                </div>
                <button onClick={() => setIsAddingBoat(false)} className="p-3 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-2xl transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddBoat} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-1">Matricula</label>
                  <div className="relative">
                    <Fingerprint className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                      required
                      type="text"
                      value={newBoatMatricula}
                      onChange={e => setNewBoatMatricula(e.target.value)}
                      placeholder="Ej: PM-3056"
                      className="w-full h-12 pl-12 pr-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm focus:outline-none focus:border-black dark:focus:border-white transition-all font-medium uppercase"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-1">Nombre Nave</label>
                  <div className="relative">
                    <Ship className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                      required
                      type="text"
                      value={newBoatName}
                      onChange={e => setNewBoatName(e.target.value)}
                      placeholder="Nombre de la embarcacion"
                      className="w-full h-12 pl-12 pr-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm focus:outline-none focus:border-black dark:focus:border-white transition-all font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-1">Capacidad</label>
                  <input
                    min={0}
                    type="number"
                    value={newBoatCapacity}
                    onChange={e => setNewBoatCapacity(Number(e.target.value))}
                    className="w-full h-12 px-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm focus:outline-none focus:border-black dark:focus:border-white transition-all font-medium"
                  />
                </div>

                <div className="pt-4 flex gap-4">
                  <button
                    type="button"
                    onClick={() => setIsAddingBoat(false)}
                    className="flex-1 h-12 bg-zinc-100 dark:bg-zinc-900 text-black dark:text-white font-bold rounded-2xl hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all text-xs tracking-widest"
                  >
                    CANCELAR
                  </button>
                  <button
                    type="submit"
                    className="flex-[2] h-12 bg-black dark:bg-white text-white dark:text-black font-black rounded-2xl hover:opacity-90 transition-all text-xs tracking-[0.2em]"
                  >
                    CREAR EMBARCACION
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
