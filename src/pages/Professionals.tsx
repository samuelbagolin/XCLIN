import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  doc, 
  setDoc,
  updateDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  Plus, 
  Stethoscope, 
  Trash2, 
  CheckCircle2, 
  Tag, 
  MoreVertical,
  UserPlus
} from 'lucide-react';
import { Professional, Specialty, UserRole } from '../types';

export function Professionals() {
  const { clinic } = useAuth();
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isProfModalOpen, setIsProfModalOpen] = useState(false);
  const [isSpecModalOpen, setIsSpecModalOpen] = useState(false);

  // Form states
  const [newProf, setNewProf] = useState({ name: '', email: '', specialties: [] as string[] });
  const [newSpec, setNewSpec] = useState('');
  const [editingProfId, setEditingProfId] = useState<string | null>(null);
  const [editingSpecId, setEditingSpecId] = useState<string | null>(null);

  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, type: 'prof' | 'spec' } | null>(null);

  const fetchData = async () => {
    if (!clinic) return;
    try {
      const pSnap = await getDocs(query(collection(db, 'professionals'), where('clinicId', '==', clinic.id)));
      setProfessionals(pSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Professional)));

      const sSnap = await getDocs(query(collection(db, 'specialties'), where('clinicId', '==', clinic.id)));
      setSpecialties(sSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Specialty)));
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [clinic]);

  const handleAddSpecialty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinic || !newSpec) return;
    try {
      if (editingSpecId) {
        await updateDoc(doc(db, 'specialties', editingSpecId), { name: newSpec });
      } else {
        await addDoc(collection(db, 'specialties'), { name: newSpec, clinicId: clinic.id });
      }
      setNewSpec('');
      setEditingSpecId(null);
      setIsSpecModalOpen(false);
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleAddProfessional = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinic || !newProf.name) return;
    try {
      if (editingProfId) {
        await updateDoc(doc(db, 'professionals', editingProfId), {
          ...newProf
        });
      } else {
        await addDoc(collection(db, 'professionals'), {
          ...newProf,
          clinicId: clinic.id,
          active: true
        });
      }
      setNewProf({ name: '', email: '', specialties: [] });
      setEditingProfId(null);
      setIsProfModalOpen(false);
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleDeleteSpec = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'specialties', id));
      setDeleteConfirm(null);
      fetchData();
    } catch (err: any) { 
      console.error(err);
      alert('Erro ao excluir especialidade: ' + err.message);
    }
  };

  const handleDeleteProf = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'professionals', id));
      setDeleteConfirm(null);
      fetchData();
    } catch (err: any) { 
      console.error(err);
      alert('Erro ao excluir profissional: ' + (err.code === 'permission-denied' ? 'Acesso negado' : err.message));
    }
  };

  const handleEditProf = (prof: Professional) => {
    setEditingProfId(prof.id);
    setNewProf({
      name: prof.name,
      email: prof.email,
      specialties: prof.specialties
    });
    setIsProfModalOpen(true);
  };

  const handleEditSpec = (spec: Specialty) => {
    setEditingSpecId(spec.id);
    setNewSpec(spec.name);
    setIsSpecModalOpen(true);
  };

  return (
    <div className="space-y-10 transition-colors duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-sans transition-colors">Profissionais e Especialidades</h1>
          <p className="text-slate-500 dark:text-slate-400 font-sans transition-colors">Gerencie a equipe técnica da clínica.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Professionals List */}
        <div className="lg:col-span-2 space-y-6 order-2 lg:order-1">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 font-sans transition-colors">Equipe</h2>
            <button onClick={() => setIsProfModalOpen(true)} className="btn-primary py-2 text-sm">
              <UserPlus size={18} />
              Adicionar Profissional
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {loading ? <p className="dark:text-slate-400">Carregando...</p> : professionals.map(prof => (
              <div key={prof.id} className="medical-card p-5 group hover:border-sky-500 transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 flex items-center justify-center font-bold text-xl uppercase shrink-0 transition-colors">
                      {prof.name.charAt(0)}
                    </div>
                    <div className="truncate">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 truncate">{prof.name}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{prof.email}</p>
                    </div>
                  </div>
                   <div className="relative group/menu shrink-0">
                    <button className="p-2 text-slate-300 hover:text-slate-600 dark:text-slate-600 dark:hover:text-slate-400 transition-colors">
                      <MoreVertical size={18} />
                    </button>
                    <div className="absolute right-0 top-full pt-1 z-50 hidden group-hover/menu:block min-w-[120px]">
                      <div className="bg-white dark:bg-slate-900 shadow-xl rounded-xl border border-slate-100 dark:border-slate-800 py-1 transition-colors">
                        <button 
                          onClick={() => handleEditProf(prof)}
                          className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                          Editar
                        </button>
                        <button 
                          onClick={() => setDeleteConfirm({ id: prof.id, type: 'prof' })}
                          className="w-full text-left px-4 py-2.5 text-xs font-semibold text-rose-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {prof.specialties.map(sid => (
                    <span key={sid} className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[9px] font-bold uppercase transition-colors">
                      {specialties.find(s => s.id === sid)?.name || 'Especialidade'}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Specialties Sidebar */}
        <div className="space-y-6 order-1 lg:order-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 font-sans transition-colors">Especialidades</h2>
            <button onClick={() => setIsSpecModalOpen(true)} className="text-sky-600 dark:text-sky-400 p-2 hover:bg-sky-50 dark:hover:bg-sky-900/10 rounded-lg transition-all">
              <Plus size={20} />
            </button>
          </div>
          <div className="medical-card p-2 bg-white dark:bg-slate-900 transition-colors">
            <div className="divide-y divide-slate-50 dark:divide-slate-800">
              {specialties.map(spec => (
                <div key={spec.id} className="p-3 flex items-center justify-between group rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-lg transition-colors"><Tag size={14} /></div>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 transition-colors">{spec.name}</span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleEditSpec(spec)} className="text-slate-300 hover:text-sky-600 dark:text-slate-600 dark:hover:text-sky-400 transition-colors p-1">
                      <Plus size={16} className="rotate-45" />
                    </button>
                    <button onClick={() => setDeleteConfirm({ id: spec.id, type: 'spec' })} className="text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 transition-colors p-1">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
              {specialties.length === 0 && <p className="p-4 text-center text-xs text-slate-400 dark:text-slate-500">Nenhuma especialidade cadastrada.</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl transition-all">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 font-sans">Excluir {deleteConfirm.type === 'prof' ? 'Profissional' : 'Especialidade'}?</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 font-sans">Tem certeza que deseja remover este item? Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3 font-sans">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 btn-secondary">Cancelar</button>
              <button 
                onClick={() => deleteConfirm.type === 'prof' ? handleDeleteProf(deleteConfirm.id) : handleDeleteSpec(deleteConfirm.id)} 
                className="flex-1 py-2 rounded-xl bg-rose-600 text-white font-bold text-sm hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/20"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {isSpecModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full shadow-xl transition-colors">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 font-sans">{editingSpecId ? 'Editar Especialidade' : 'Nova Especialidade'}</h3>
            <form onSubmit={handleAddSpecialty} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-100 uppercase tracking-wider transition-colors">Nome da Especialidade</label>
                <input 
                  type="text" required placeholder="Ex: Fonoaudiologia Infantil" 
                  className="input-field w-full" value={newSpec} onChange={e => setNewSpec(e.target.value)} 
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setIsSpecModalOpen(false)} className="flex-1 btn-secondary font-sans">Cancelar</button>
                <button type="submit" className="flex-1 btn-primary font-sans">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isProfModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full shadow-xl my-auto transition-colors">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6 font-sans">{editingProfId ? 'Editar Profissional' : 'Cadastrar Profissional'}</h3>
            <form onSubmit={handleAddProfessional} className="p-0 space-y-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-100 uppercase tracking-wider mb-1.5 transition-colors">Nome Completo</label>
                  <input type="text" required className="input-field w-full" value={newProf.name} onChange={e => setNewProf({...newProf, name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-100 uppercase tracking-wider mb-1.5 transition-colors">E-mail de Trabalho</label>
                  <input type="email" required className="input-field w-full" value={newProf.email} onChange={e => setNewProf({...newProf, email: e.target.value})} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-100 uppercase tracking-wider mb-2.5 transition-colors">Especialidades Atuantes</p>
                  <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto p-1.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl transition-colors">
                    {specialties.map(spec => (
                      <label key={spec.id} className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg cursor-pointer hover:border-sky-500 transition-all">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 dark:bg-slate-800 dark:border-slate-700"
                          checked={newProf.specialties.includes(spec.id)}
                          onChange={(e) => {
                            if (e.target.checked) setNewProf({...newProf, specialties: [...newProf.specialties, spec.id]});
                            else setNewProf({...newProf, specialties: newProf.specialties.filter(id => id !== spec.id)});
                          }}
                        />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{spec.name}</span>
                      </label>
                    ))}
                    {specialties.length === 0 && <p className="text-center py-4 text-xs text-slate-400 italic">Cadastre especialidades primeiro.</p>}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <button type="button" onClick={() => setIsProfModalOpen(false)} className="flex-1 btn-secondary font-sans font-bold">Cancelar</button>
                <button type="submit" className="flex-1 btn-primary font-sans font-bold">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
