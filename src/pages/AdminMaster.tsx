import React, { useEffect, useState } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc, 
  addDoc, 
  serverTimestamp,
  orderBy,
  getDocs,
  where,
  limit
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Clinic } from '../types';
import { 
  Building2, 
  Users, 
  Mail, 
  Phone, 
  Calendar, 
  CheckCircle2, 
  X,
  Trash2, 
  ShieldCheck,
  Search,
  Filter,
  MoreVertical,
  AlertCircle,
  Clock,
  Ban,
  RefreshCw,
  Edit,
  Eye,
  Activity,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function AdminMaster() {
  const { profile } = useAuth();
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'active' | 'blocked'>('all');
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);
  const [clinicStats, setClinicStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (profile?.role !== 'super_admin') return;

    const q = query(collection(db, 'clinics'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const clinicsData = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Clinic[];
      setClinics(clinicsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile]);

  const fetchClinicStats = async (clinicId: string) => {
    setLoadingStats(true);
    try {
      const [patientsSnap, professionalsSnap] = await Promise.all([
        getDocs(query(collection(db, 'patients'), where('clinicId', '==', clinicId))),
        getDocs(query(collection(db, 'professionals'), where('clinicId', '==', clinicId)))
      ]);

      setClinicStats({
        patientsCount: patientsSnap.size,
        professionalsCount: professionalsSnap.size,
      });
    } catch (error) {
      console.error("Error fetching clinic stats:", error);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleOpenDetail = (clinic: Clinic) => {
    setSelectedClinic(clinic);
    setIsDetailModalOpen(true);
    fetchClinicStats(clinic.id);
  };

  const handleOpenEdit = (clinic: Clinic) => {
    setSelectedClinic(clinic);
    setIsEditModalOpen(true);
  };

  const handleUpdateClinic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClinic) return;

    try {
      const clinicRef = doc(db, 'clinics', selectedClinic.id);
      await updateDoc(clinicRef, {
        name: selectedClinic.name,
        ownerName: selectedClinic.ownerName,
        ownerEmail: selectedClinic.ownerEmail,
        ownerPhone: selectedClinic.ownerPhone,
        status: selectedClinic.status,
        updatedAt: serverTimestamp()
      });

      // Sync owner user status if changed
      if (selectedClinic.ownerId) {
        await updateDoc(doc(db, 'users', selectedClinic.ownerId), {
          status: selectedClinic.status === 'active' || selectedClinic.status === 'pending' ? 'active' : 'blocked'
        });
      }

      setIsEditModalOpen(false);
      
      // Log
      await addDoc(collection(db, 'admin_logs'), {
        action: 'edit_clinic',
        clinicId: selectedClinic.id,
        clinicName: selectedClinic.name,
        performedBy: profile?.uid,
        performedByName: profile?.displayName,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error("Error updating clinic:", error);
      alert("Erro ao salvar alterações.");
    }
  };

  const handleAction = async (clinic: Clinic, action: 'approve' | 'block' | 'unblock' | 'delete') => {
    if (!profile) return;
    setActionLoading(true);

    try {
      if (action === 'delete') {
        const statusMap = {
          delete: 'cancelled'
        };

        const updates: any = {
          status: 'cancelled',
          deletedAt: serverTimestamp(),
          deletedBy: profile.uid,
          updatedAt: serverTimestamp()
        };

        await updateDoc(doc(db, 'clinics', clinic.id), updates);
        
        // Also update the owner's status in users collection to blocked/cancelled
        if (clinic.ownerId) {
          await updateDoc(doc(db, 'users', clinic.ownerId), {
            status: 'blocked'
          });
        }

        // Log delete action
        await addDoc(collection(db, 'admin_logs'), {
          action: 'delete_clinic',
          clinicId: clinic.id,
          clinicName: clinic.name,
          performedBy: profile.uid,
          performedByName: profile.displayName,
          timestamp: serverTimestamp()
        });
        
        setIsDeleteModalOpen(false);
        return;
      }

      const statusMap = {
        approve: 'active',
        block: 'blocked',
        unblock: 'active'
      };

      const updates: any = {
        status: statusMap[action],
        updatedAt: serverTimestamp()
      };

      if (action === 'approve') {
        updates.approvedAt = serverTimestamp();
        updates.approvedBy = profile.uid;
      }

      await updateDoc(doc(db, 'clinics', clinic.id), updates);
      
      if (clinic.ownerId) {
        await updateDoc(doc(db, 'users', clinic.ownerId), {
          status: statusMap[action] === 'active' ? 'active' : 'blocked'
        });
      }

      await addDoc(collection(db, 'admin_logs'), {
        action,
        clinicId: clinic.id,
        clinicName: clinic.name,
        performedBy: profile.uid,
        performedByName: profile.displayName,
        timestamp: serverTimestamp()
      });

    } catch (error) {
      console.error(`Error performing admin action (${action}):`, error);
      alert('Erro ao realizar ação. Verifique o console.');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredClinics = clinics.filter(c => {
    const matchesSearch = 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.ownerEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.ownerName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="animate-spin text-sky-600" size={32} />
          <p className="text-slate-500 font-medium">Carregando painel master...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-sky-900 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-sky-900/20">
            <ShieldCheck size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Admin Master</h1>
            <p className="text-slate-500 text-sm">Gestão global de clínicas e acessos</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
           <div className="bg-white rounded-2xl p-1 shadow-sm border border-slate-200 flex">
             {(['all', 'pending', 'active', 'blocked'] as const).map(s => (
               <button
                 key={s}
                 onClick={() => setStatusFilter(s)}
                 className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${statusFilter === s ? 'bg-sky-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
               >
                 {s === 'all' ? 'Todas' : s === 'pending' ? 'Pendentes' : s === 'active' ? 'Ativas' : 'Bloqueadas'}
               </button>
             ))}
           </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Total</p>
          <p className="text-2xl font-black text-slate-900">{clinics.length}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <p className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-1">Pendentes</p>
          <p className="text-2xl font-black text-amber-600">{clinics.filter(c => c.status === 'pending').length}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <p className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-1">Ativas</p>
          <p className="text-2xl font-black text-emerald-600">{clinics.filter(c => c.status === 'active').length}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
           <p className="text-xs font-bold text-rose-500 uppercase tracking-widest mb-1">Bloqueadas</p>
          <p className="text-2xl font-black text-rose-600">{clinics.filter(c => c.status === 'blocked').length}</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text"
            placeholder="Buscar por clínica, dono, e-mail..."
            className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/10 focus:border-sky-500 transition-all font-medium"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Clinics Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Clínica / Resp</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Contato</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Cadastro</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredClinics.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-medium">Nenhuma clínica encontrada.</td>
                </tr>
              ) : (
                filteredClinics.map((clinic) => (
                  <tr key={clinic.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-500 shrink-0 font-bold group-hover:bg-sky-100 group-hover:text-sky-600 transition-colors">
                          {clinic.logoUrl ? (
                            <img src={clinic.logoUrl} className="w-full h-full object-cover rounded-2xl" alt="" referrerPolicy="no-referrer" />
                          ) : (
                            <Building2 size={20} />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">{clinic.name}</p>
                          <p className="text-xs text-slate-500 flex items-center gap-1">
                            <Users size={12} className="shrink-0" />
                            <span className="truncate">{clinic.ownerName || 'Responsável'}</span>
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                          <Mail size={12} className="text-slate-400" />
                          {clinic.ownerEmail}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                          <Phone size={12} className="text-slate-400" />
                          {clinic.ownerPhone || 'N/A'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <p className="text-xs font-bold text-slate-700">
                           {clinic.createdAt ? (clinic.createdAt instanceof Date ? clinic.createdAt : (clinic.createdAt as any).toDate?.() || new Date(clinic.createdAt)).toLocaleDateString('pt-BR') : 'N/A'}
                        </p>
                        <p className="text-[10px] text-slate-400 uppercase font-black">Data de início</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`
                        inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider
                        ${clinic.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 
                          clinic.status === 'pending' ? 'bg-amber-100 text-amber-700 animate-pulse' : 
                          clinic.status === 'blocked' ? 'bg-rose-100 text-rose-700' :
                          'bg-slate-100 text-slate-600'}
                      `}>
                        {clinic.status === 'active' ? <CheckCircle2 size={10} /> : 
                         clinic.status === 'pending' ? <Clock size={10} /> : 
                         clinic.status === 'blocked' ? <Ban size={10} /> : <AlertCircle size={10} />}
                        {clinic.status === 'active' ? 'Ativa' : clinic.status === 'pending' ? 'Pendente' : clinic.status === 'blocked' ? 'Bloqueada' : 'Outra'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleOpenDetail(clinic)}
                          className="p-2 bg-slate-50 text-slate-600 hover:bg-slate-200 rounded-xl transition-all shadow-sm"
                          title="Ver Detalhes"
                        >
                          <Eye size={18} />
                        </button>
                        <button 
                          onClick={() => handleOpenEdit(clinic)}
                          className="p-2 bg-sky-50 text-sky-600 hover:bg-sky-600 hover:text-white rounded-xl transition-all shadow-sm"
                          title="Editar Clínica"
                        >
                          <Edit size={18} />
                        </button>
                        {clinic.status === 'pending' && (
                          <button 
                            onClick={() => handleAction(clinic, 'approve')}
                            className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-xl transition-all shadow-sm"
                            title="Aprovar Clínica"
                          >
                            <CheckCircle2 size={18} />
                          </button>
                        )}
                        {clinic.status === 'active' && (
                          <button 
                            onClick={() => handleAction(clinic, 'block')}
                            className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-xl transition-all shadow-sm"
                            title="Bloquear Clínica"
                          >
                            <Ban size={18} />
                          </button>
                        )}
                        {clinic.status === 'blocked' && (
                          <button 
                            onClick={() => handleAction(clinic, 'unblock')}
                            className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-xl transition-all shadow-sm"
                            title="Desbloquear Clínica"
                          >
                            <RefreshCw size={18} />
                          </button>
                        )}
                        <button 
                          onClick={() => { setSelectedClinic(clinic); setIsDeleteModalOpen(true); }}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                          title="Excluir Clínica"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {isEditModalOpen && selectedClinic && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-sky-50 text-sky-600 rounded-2xl flex items-center justify-center shadow-inner">
                      <Edit size={28} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-slate-900 tracking-tight">Editar Clínica</h2>
                      <p className="text-slate-500 font-medium tracking-tight">Atualize as informações administrativas</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsEditModalOpen(false)}
                    className="p-3 hover:bg-slate-100 rounded-2xl transition-colors"
                  >
                    <X size={24} className="text-slate-400" />
                  </button>
                </div>

                <form onSubmit={handleUpdateClinic} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-widest px-1">Nome da Clínica</label>
                      <input 
                        type="text"
                        required
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 transition-all"
                        value={selectedClinic.name}
                        onChange={e => setSelectedClinic({...selectedClinic, name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-widest px-1">Responsável</label>
                      <input 
                        type="text"
                        required
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 transition-all"
                        value={selectedClinic.ownerName || ''}
                        onChange={e => setSelectedClinic({...selectedClinic, ownerName: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-widest px-1">E-mail</label>
                      <input 
                        type="email"
                        required
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 transition-all"
                        value={selectedClinic.ownerEmail || ''}
                        onChange={e => setSelectedClinic({...selectedClinic, ownerEmail: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-widest px-1">WhatsApp</label>
                      <input 
                        type="tel"
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 transition-all"
                        value={selectedClinic.ownerPhone || ''}
                        onChange={e => setSelectedClinic({...selectedClinic, ownerPhone: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-widest px-1">Status da Conta</label>
                      <div className="grid grid-cols-3 gap-3">
                        {(['pending', 'active', 'blocked'] as const).map(s => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setSelectedClinic({...selectedClinic, status: s})}
                            className={`p-4 rounded-2xl text-xs font-black uppercase tracking-widest border transition-all ${selectedClinic.status === s ? 'bg-sky-600 border-sky-600 text-white shadow-lg shadow-sky-600/20' : 'bg-white border-slate-200 text-slate-500 hover:border-sky-200 hover:bg-sky-50'}`}
                          >
                            {s === 'pending' ? 'Pendente' : s === 'active' ? 'Ativa' : 'Bloqueada'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button 
                      type="button"
                      onClick={() => setIsEditModalOpen(false)}
                      className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black uppercase tracking-widest p-5 rounded-2xl transition-all"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit"
                      className="flex-3 bg-slate-900 border-b-4 border-slate-700 hover:bg-slate-800 text-white font-black uppercase tracking-widest p-5 rounded-2xl transition-all transform active:translate-y-1 active:border-b-0"
                    >
                      Salvar Alterações
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Detail Modal */}
      <AnimatePresence>
        {isDetailModalOpen && selectedClinic && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDetailModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-slate-200"
            >
              <div className="flex flex-col md:flex-row h-full max-h-[90vh]">
                {/* Lateral Deco/Info */}
                <div className="w-full md:w-80 bg-slate-900 p-10 text-white flex flex-col justify-between overflow-y-auto">
                   <div>
                    <div className="w-20 h-20 bg-white/10 rounded-3xl flex items-center justify-center mb-8 backdrop-blur-md border border-white/10">
                      {selectedClinic.logoUrl ? (
                         <img src={selectedClinic.logoUrl} className="w-full h-full object-cover rounded-3xl" alt="" referrerPolicy="no-referrer" />
                      ) : (
                        <Building2 size={36} className="text-sky-400" />
                      )}
                    </div>
                    <h3 className="text-3xl font-black tracking-tight leading-none mb-2">{selectedClinic.name}</h3>
                    <p className="text-sky-400 font-bold uppercase tracking-widest text-xs mb-8">{selectedClinic.status === 'active' ? 'Operacional' : 'Restrita'}</p>
                    
                    <div className="space-y-6">
                      <div className="flex items-center gap-4 group cursor-pointer">
                        <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center group-hover:bg-white/20 transition-all">
                          <Users size={18} className="text-slate-400" />
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Responsável</p>
                          <p className="text-sm font-bold">{selectedClinic.ownerName || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 group cursor-pointer">
                        <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center group-hover:bg-white/20 transition-all">
                          <Mail size={18} className="text-slate-400" />
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">E-mail</p>
                          <p className="text-sm font-bold truncate max-w-[150px]">{selectedClinic.ownerEmail}</p>
                        </div>
                      </div>
                    </div>
                   </div>

                   <div className="pt-12">
                     <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-4">Métricas Atuais</p>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                           <p className="text-2xl font-black">{loadingStats ? '...' : clinicStats?.patientsCount || 0}</p>
                           <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Pacientes</p>
                        </div>
                        <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                           <p className="text-2xl font-black">{loadingStats ? '...' : clinicStats?.professionalsCount || 0}</p>
                           <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Staff</p>
                        </div>
                     </div>
                   </div>
                </div>

                {/* Main Detail Area */}
                <div className="flex-1 p-10 overflow-y-auto bg-slate-50/50">
                  <div className="flex justify-end mb-8">
                    <button 
                      onClick={() => setIsDetailModalOpen(false)}
                      className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-slate-900 transition-all shadow-sm active:scale-95"
                    >
                      <X size={24} />
                    </button>
                  </div>

                  <div className="space-y-10">
                     {/* Timeline/Info Grid */}
                     <section>
                       <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                         <Activity size={14} className="text-sky-500" />
                         Informações Estruturais
                       </h4>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-start gap-4">
                            <div className="w-12 h-12 bg-sky-50 text-sky-600 rounded-2xl flex items-center justify-center shrink-0">
                               <Calendar size={24} />
                            </div>
                            <div>
                               <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Data de Cadastro</p>
                               <p className="font-bold text-slate-900">
                                 {selectedClinic.createdAt ? (selectedClinic.createdAt instanceof Date ? selectedClinic.createdAt : (selectedClinic.createdAt as any).toDate?.() || new Date(selectedClinic.createdAt)).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : 'N/A'}
                               </p>
                            </div>
                         </div>
                         <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-start gap-4">
                            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0">
                               <CheckCircle2 size={24} />
                            </div>
                            <div>
                               <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Data de Aprovação</p>
                               <p className="font-bold text-slate-900">
                                 {selectedClinic.approvedAt ? (selectedClinic.approvedAt instanceof Date ? selectedClinic.approvedAt : (selectedClinic.approvedAt as any).toDate?.() || new Date(selectedClinic.approvedAt)).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Pendente'}
                               </p>
                            </div>
                         </div>
                       </div>
                     </section>

                     <section>
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                         <ShieldCheck size={14} className="text-sky-500" />
                         Segurança e Acessos
                       </h4>
                        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 space-y-6">
                           <div className="flex items-center justify-between py-4 border-b border-slate-50">
                              <span className="text-sm font-bold text-slate-500">UID da Clínica</span>
                              <code className="text-xs bg-slate-100 px-3 py-1 rounded-lg text-slate-600 font-mono">{selectedClinic.id}</code>
                           </div>
                           <div className="flex items-center justify-between py-4 border-b border-slate-50">
                              <span className="text-sm font-bold text-slate-500">UID do Responsável</span>
                              <code className="text-xs bg-slate-100 px-3 py-1 rounded-lg text-slate-600 font-mono">{selectedClinic.ownerId || 'Não vinculado'}</code>
                           </div>
                           <div className="flex items-center justify-between py-4">
                              <span className="text-sm font-bold text-slate-500">Estado de Sincronização</span>
                              <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs uppercase tracking-widest">
                                 <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                 Sincronizado
                              </div>
                           </div>
                        </div>
                     </section>

                     <div className="flex gap-4 pt-4">
                        <button 
                          onClick={() => { setIsDetailModalOpen(false); handleOpenEdit(selectedClinic); }}
                          className="flex-1 bg-slate-900 text-white font-black uppercase tracking-widest p-5 rounded-2xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                        >
                          <Edit size={20} />
                          Editar Dados
                        </button>
                        <button 
                          onClick={() => handleAction(selectedClinic, selectedClinic.status === 'blocked' ? 'unblock' : 'block')}
                          className={`flex-1 font-black uppercase tracking-widest p-5 rounded-2xl transition-all border-b-4 flex items-center justify-center gap-2 ${selectedClinic.status === 'blocked' ? 'bg-emerald-50 border-emerald-600 text-emerald-700 hover:bg-emerald-100' : 'bg-rose-50 border-rose-600 text-rose-700 hover:bg-rose-100'}`}
                        >
                           {selectedClinic.status === 'blocked' ? <CheckCircle2 size={20} /> : <Ban size={20} />}
                           {selectedClinic.status === 'blocked' ? 'Reativar Conta' : 'Suspender Conta'}
                        </button>
                     </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && selectedClinic && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDeleteModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200"
            >
              <div className="p-8">
                <div className="flex flex-col items-center text-center">
                  <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-[2rem] flex items-center justify-center mb-6 shadow-inner shadow-rose-600/5">
                    <AlertCircle size={40} />
                  </div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Confirmar Exclusão</h2>
                  <p className="text-slate-500 font-medium mb-8">
                    Tem certeza que deseja excluir a clínica <span className="font-bold text-slate-900">"{selectedClinic.name}"</span>?
                    <br />
                    <span className="text-sm text-rose-500">Esta ação pode impactar usuários e registros vinculados.</span>
                  </p>
                  
                  <div className="flex flex-col gap-3 w-full">
                    <button 
                      onClick={() => handleAction(selectedClinic, 'delete')}
                      disabled={actionLoading}
                      className="w-full bg-rose-600 border-b-4 border-rose-800 hover:bg-rose-700 text-white font-black uppercase tracking-widest p-5 rounded-2xl transition-all transform active:translate-y-1 active:border-b-0 flex items-center justify-center gap-2"
                    >
                      {actionLoading ? (
                        <RefreshCw className="animate-spin" size={20} />
                      ) : (
                        <Trash2 size={20} />
                      )}
                      Confirmar Exclusão
                    </button>
                    <button 
                      onClick={() => setIsDeleteModalOpen(false)}
                      className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-black uppercase tracking-widest p-5 rounded-2xl transition-all"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
