import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, updateDoc, collection, query, where, getDocs, setDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { initializeApp, deleteApp, getApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { 
  Building2, 
  Image as ImageIcon, 
  Save, 
  UserPlus, 
  Shield, 
  Mail,
  UserCheck,
  Trash2
} from 'lucide-react';
import { UserRole } from '../types';

export function Settings() {
  const { clinic, refreshProfile } = useAuth();
  const [clinicName, setClinicName] = useState(clinic?.name || '');
  const [logoUrl, setLogoUrl] = useState(clinic?.logoUrl || '');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // User management
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('professional');
  const [users, setUsers] = useState<any[]>([]);

  const [deleteConfirmUser, setDeleteConfirmUser] = useState<any | null>(null);

  const fetchUsers = async () => {
    if (!clinic) return;
    try {
      const q = query(collection(db, 'users'), where('clinicId', '==', clinic.id));
      const snap = await getDocs(q);
      setUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [clinic]);

  const handleUpdateClinic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinic) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'clinics', clinic.id), {
        name: clinicName,
        logoUrl: logoUrl
      });
      setMessage('Configurações atualizadas!');
      await refreshProfile();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error(err);
      setMessage('Erro ao atualizar.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinic || !newUserEmail || !newUserPassword || !newUserName) return;
    setLoading(true);
    let secondaryApp;
    try {
      // Use a secondary app to create the user without logging out the main user
      const secondaryAppName = `secondary-app-${Date.now()}`;
      secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
      const secondaryAuth = getAuth(secondaryApp);
      
      const result = await createUserWithEmailAndPassword(secondaryAuth, newUserEmail, newUserPassword);
      await updateProfile(result.user, { displayName: newUserName });
      
      await setDoc(doc(db, 'users', result.user.uid), {
        uid: result.user.uid,
        email: newUserEmail,
        displayName: newUserName,
        role: newUserRole,
        clinicId: clinic.id,
        createdAt: serverTimestamp()
      });

      // Sign out from the secondary app specifically
      await signOut(secondaryAuth);
      
      setMessage(`Usuário ${newUserName} criado com sucesso!`);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      fetchUsers();
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      console.error(err);
      setMessage('Erro ao criar usuário: ' + err.message);
    } finally {
      if (secondaryApp) await deleteApp(secondaryApp);
      setLoading(false);
    }
  };

  const handleDeleteUser = async (user: any) => {
    if (user.uid === clinic?.ownerId) return alert('O proprietário não pode ser removido.');
    
    try {
      await deleteDoc(doc(db, 'users', user.id));
      setDeleteConfirmUser(null);
      fetchUsers();
    } catch (err: any) { 
      console.error(err);
      alert('Erro ao excluir usuário: ' + (err.code === 'permission-denied' ? 'Acesso negado (apenas administradores)' : err.message));
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 transition-colors duration-300">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-sans transition-colors">Configurações</h1>
        <p className="text-slate-500 dark:text-slate-400 transition-colors">Mantenha os dados da sua clínica e usuários atualizados.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Clinic Info */}
        <div className="space-y-6">
          <div className="medical-card p-6">
            <h3 className="font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2 font-sans transition-colors">
              <Building2 size={20} className="text-sky-600" />
              Perfil da Clínica
            </h3>
            <form onSubmit={handleUpdateClinic} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-100 uppercase tracking-wider mb-1.5 transition-colors">Nome da Clínica</label>
                <input 
                  type="text" required className="input-field" 
                  value={clinicName} onChange={e => setClinicName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-100 uppercase tracking-wider mb-1.5 transition-colors">URL da Logo</label>
                <div className="flex gap-2">
                  <input 
                    type="url" className="input-field flex-1" 
                    placeholder="https://exemplo.com/logo.png"
                    value={logoUrl} onChange={e => setLogoUrl(e.target.value)}
                  />
                  {logoUrl && (
                    <div className="w-10 h-10 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-800 transition-colors">
                      <img src={logoUrl} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                    </div>
                  )}
                </div>
              </div>
              {message && <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{message}</p>}
              <div className="pt-2">
                <button type="submit" disabled={loading} className="btn-primary w-full">
                  <Save size={18} />
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* User Management Info */}
        <div className="space-y-6">
          <div className="medical-card p-6">
            <h3 className="font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2 font-sans transition-colors">
              <Shield size={20} className="text-sky-600" />
              Gestão de Usuários
            </h3>
            <div className="space-y-6">
              <form onSubmit={handleCreateUser} className="space-y-4">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 font-sans transition-colors">Criar Novo Usuário</h4>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-100 uppercase tracking-wider mb-1.5 block transition-colors">Nome Completo</label>
                  <input 
                    type="text" required
                    className="input-field text-sm"
                    value={newUserName}
                    onChange={e => setNewUserName(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-100 uppercase tracking-wider mb-1.5 block transition-colors">E-mail</label>
                    <input 
                      type="email" required
                      className="input-field text-sm"
                      value={newUserEmail}
                      onChange={e => setNewUserEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-100 uppercase tracking-wider mb-1.5 block transition-colors">Senha</label>
                    <input 
                      type="password" required
                      className="input-field text-sm"
                      value={newUserPassword}
                      onChange={e => setNewUserPassword(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-100 uppercase tracking-wider mb-1.5 block transition-colors">Tipo de Perfil</label>
                  <select 
                    className="input-field text-sm bg-white dark:bg-slate-800"
                    value={newUserRole}
                    onChange={e => setNewUserRole(e.target.value as UserRole)}
                  >
                    <option value="professional">Profissional (Fono, Psicólogo...)</option>
                    <option value="receptionist">Secretaria / Atendimento</option>
                    <option value="admin">Administrador (Gestão total)</option>
                  </select>
                </div>
                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full btn-secondary text-xs"
                >
                  <UserPlus size={16} />
                  Criar Usuário
                </button>
              </form>

              <div className="space-y-4">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 font-sans transition-colors">Usuários Atuais</h4>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {users.map(u => (
                    <div key={u.id} className="py-3 flex items-center justify-between transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xs font-bold uppercase transition-colors text-slate-700 dark:text-slate-300">
                          {u.displayName?.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 transition-colors">{u.displayName}</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider transition-colors">{u.role}</p>
                        </div>
                      </div>
                      {u.role !== 'admin' && (
                        <button 
                          onClick={() => setDeleteConfirmUser(u)}
                          className="text-xs text-slate-400 hover:text-red-500 dark:hover:text-red-400 font-medium px-2 py-1 flex items-center gap-1 transition-colors"
                        >
                          <Trash2 size={12} />
                          Remover
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl transition-all">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 font-sans tracking-tight">Remover Usuário?</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 font-sans">Deseja remover o acesso de <b>{deleteConfirmUser.displayName}</b>? Ele não poderá mais acessar a plataforma.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirmUser(null)} className="flex-1 btn-secondary font-bold text-sm">Cancelar</button>
              <button 
                onClick={() => handleDeleteUser(deleteConfirmUser)} 
                className="flex-1 py-2 rounded-xl bg-rose-600 text-white font-bold text-sm hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/20"
              >
                Sim, Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper to make useEffect work in this file
// (Removed redundant import)
