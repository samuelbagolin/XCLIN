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
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Profissionais e Especialidades</h1>
          <p className="text-slate-500">Gerencie a equipe técnica da clínica.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Professionals List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">Equipe</h2>
            <button onClick={() => setIsProfModalOpen(true)} className="btn-primary py-2 text-sm">
              <UserPlus size={18} />
              Adicionar Profissional
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {loading ? <p>Carregando...</p> : professionals.map(prof => (
              <div key={prof.id} className="medical-card p-5 group">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xl uppercase">
                      {prof.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">{prof.name}</h4>
                      <p className="text-xs text-slate-500">{prof.email}</p>
                    </div>
                  </div>
                   <div className="relative group/menu">
                    <button className="p-2 text-slate-300 hover:text-slate-600 transition-colors">
                      <MoreVertical size={18} />
                    </button>
                    <div className="absolute right-0 top-full pt-1 z-50 hidden group-hover/menu:block min-w-[120px]">
                      <div className="bg-white shadow-lg rounded-xl border border-slate-100 py-1">
                        <button 
                          onClick={() => handleEditProf(prof)}
                          className="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          Editar
                        </button>
                        <button 
                          onClick={() => setDeleteConfirm({ id: prof.id, type: 'prof' })}
                          className="w-full text-left px-4 py-2 text-xs font-medium text-rose-600 hover:bg-slate-50 transition-colors"
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {prof.specialties.map(sid => (
                    <span key={sid} className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold uppercase">
                      {specialties.find(s => s.id === sid)?.name || 'Especialidade'}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Specialties Sidebar */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">Especialidades</h2>
            <button onClick={() => setIsSpecModalOpen(true)} className="text-sky-600 p-2 hover:bg-sky-50 rounded-lg transition-all">
              <Plus size={20} />
            </button>
          </div>
          <div className="medical-card p-2">
            <div className="divide-y divide-slate-50">
              {specialties.map(spec => (
                <div key={spec.id} className="p-3 flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-slate-100 text-slate-400 rounded-lg"><Tag size={14} /></div>
                    <span className="text-sm font-medium text-slate-700">{spec.name}</span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleEditSpec(spec)} className="text-slate-300 hover:text-sky-600 transition-colors p-1">
                      <Plus size={16} className="rotate-45" />
                    </button>
                    <button onClick={() => setDeleteConfirm({ id: spec.id, type: 'spec' })} className="text-slate-300 hover:text-red-500 transition-colors p-1">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
              {specialties.length === 0 && <p className="p-4 text-center text-xs text-slate-400">Nenhuma especialidade cadastrada.</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl transition-all">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Excluir {deleteConfirm.type === 'prof' ? 'Profissional' : 'Especialidade'}?</h3>
            <p className="text-sm text-slate-500 mb-6">Tem certeza que deseja remover este item? Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3">
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
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold mb-4">{editingSpecId ? 'Editar Especialidade' : 'Nova Especialidade'}</h3>
            <form onSubmit={handleAddSpecialty} className="space-y-4">
              <input 
                type="text" required placeholder="Ex: Fonoaudiologia Infantil" 
                className="input-field" value={newSpec} onChange={e => setNewSpec(e.target.value)} 
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => setIsSpecModalOpen(false)} className="flex-1 btn-secondary">Cancelar</button>
                <button type="submit" className="flex-1 btn-primary">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isProfModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-6">{editingProfId ? 'Editar Profissional' : 'Cadastrar Profissional'}</h3>
            <form onSubmit={handleAddProfessional} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
                <input type="text" required className="input-field" value={newProf.name} onChange={e => setNewProf({...newProf, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
                <input type="email" required className="input-field" value={newProf.email} onChange={e => setNewProf({...newProf, email: e.target.value})} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">Especialidades</p>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1">
                  {specialties.map(spec => (
                    <label key={spec.id} className="flex items-center gap-2 p-2 border border-slate-100 rounded-lg cursor-pointer hover:bg-slate-50">
                      <input 
                        type="checkbox" 
                        checked={newProf.specialties.includes(spec.id)}
                        onChange={(e) => {
                          if (e.target.checked) setNewProf({...newProf, specialties: [...newProf.specialties, spec.id]});
                          else setNewProf({...newProf, specialties: newProf.specialties.filter(id => id !== spec.id)});
                        }}
                      />
                      <span className="text-xs font-medium text-slate-600">{spec.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <button type="button" onClick={() => setIsProfModalOpen(false)} className="flex-1 btn-secondary">Cancelar</button>
                <button type="submit" className="flex-1 btn-primary">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
