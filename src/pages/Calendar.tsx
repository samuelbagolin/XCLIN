import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp, 
  Timestamp,
  orderBy
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Clock, 
  User, 
  Stethoscope,
  MoreVertical,
  CheckCircle2
} from 'lucide-react';
import { Appointment, Patient, Professional } from '../types';

export function Calendar() {
  const { clinic, profile } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAppId, setEditingAppId] = useState<string|null>(null);
  const [loading, setLoading] = useState(true);

  // New appointment state
  const [newApp, setNewApp] = useState({
    patientId: '',
    professionalId: '',
    time: '08:00',
    type: 'Consulta'
  });

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const [filterProfessionalId, setFilterProfessionalId] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  const fetchData = async () => {
    if (!clinic) return;
    setLoading(true);
    try {
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0,0,0,0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23,59,59,999);

      // Query broad then filter to avoid index requirement
      const q = query(
        collection(db, 'appointments'),
        where('clinicId', '==', clinic.id)
      );
      const snap = await getDocs(q);
      const allApps = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
      
      const dayApps = allApps
        .filter(app => {
          const d = app.startTime?.toDate();
          if (!d) return false;
          return d >= startOfDay && d <= endOfDay;
        })
        .sort((a, b) => a.startTime.seconds - b.startTime.seconds);

      setAppointments(dayApps);

      const pSnap = await getDocs(query(collection(db, 'patients'), where('clinicId', '==', clinic.id)));
      setPatients(pSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient)).sort((a,b) => a.name.localeCompare(b.name)));

      const profSnap = await getDocs(query(collection(db, 'professionals'), where('clinicId', '==', clinic.id)));
      setProfessionals(profSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Professional)).sort((a,b) => a.name.localeCompare(b.name)));
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'appointments/calendar');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [clinic, selectedDate]);

  const filteredAppointments = appointments.filter(app => {
    const matchesProf = !filterProfessionalId || app.professionalId === filterProfessionalId;
    const matchesStatus = !filterStatus || app.status === filterStatus;
    return matchesProf && matchesStatus;
  });

  const handleAddAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinic || !newApp.patientId || !newApp.professionalId) return;

    try {
      const startTime = new Date(selectedDate);
      const [hours, minutes] = newApp.time.split(':').map(Number);
      startTime.setHours(hours, minutes, 0, 0);
      
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + 50); // Default 50min session

      const patient = patients.find(p => p.id === newApp.patientId);
      const professional = professionals.find(p => p.id === newApp.professionalId);

      if (editingAppId) {
        await updateDoc(doc(db, 'appointments', editingAppId), {
          patientId: newApp.patientId,
          patientName: patient?.name || '',
          professionalId: newApp.professionalId,
          professionalName: professional?.name || '',
          startTime: Timestamp.fromDate(startTime),
          endTime: Timestamp.fromDate(endTime),
          type: newApp.type,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'appointments'), {
          patientId: newApp.patientId,
          patientName: patient?.name || '',
          professionalId: newApp.professionalId,
          professionalName: professional?.name || '',
          startTime: Timestamp.fromDate(startTime),
          endTime: Timestamp.fromDate(endTime),
          status: 'scheduled',
          type: newApp.type,
          clinicId: clinic.id,
          createdAt: serverTimestamp()
        });
      }

      setIsModalOpen(false);
      setEditingAppId(null);
      fetchData();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'appointments');
    }
  };

  const handleUpdateStatus = async (id: string, status: Appointment['status']) => {
    try {
      await updateDoc(doc(db, 'appointments', id), { 
        status,
        updatedAt: serverTimestamp()
      });
      fetchData();
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `appointments/${id}`);
    }
  };

  const handleDeleteAppointment = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'appointments', id));
      setDeleteConfirmId(null);
      fetchData();
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, `appointments/${id}`);
    }
  };

  const handleEdit = (app: Appointment) => {
    setEditingAppId(app.id);
    const date = app.startTime.toDate();
    setNewApp({
      patientId: app.patientId,
      professionalId: app.professionalId,
      time: date.getHours().toString().padStart(2, '0') + ':' + date.getMinutes().toString().padStart(2, '0'),
      type: app.type
    });
    setIsModalOpen(true);
  };

  const changeDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  };

  // Time slots for the view
  const timeSlots = [];
  for (let i = 8; i <= 18; i++) {
    timeSlots.push(`${i.toString().padStart(2, '0')}:00`);
    timeSlots.push(`${i.toString().padStart(2, '0')}:30`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Agenda</h1>
          <p className="text-slate-500">Acompanhe e gerencie as consultas da clínica.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-white border border-slate-200 rounded-xl flex items-center p-1 w-full md:w-auto justify-between md:justify-start">
            <button onClick={() => changeDate(-1)} className="p-2 hover:bg-slate-50 rounded-lg text-slate-500 active:scale-90 transition-transform"><ChevronLeft size={20} /></button>
            <div className="px-4 font-semibold text-slate-700 min-w-[150px] text-center text-sm md:text-base">
              {selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
            </div>
            <button onClick={() => changeDate(1)} className="p-2 hover:bg-slate-50 rounded-lg text-slate-500 active:scale-90 transition-transform"><ChevronRight size={20} /></button>
          </div>
          <div className="flex items-center gap-2 flex-1 md:flex-none">
            <select 
              className="text-xs border border-slate-200 rounded-xl py-2 px-3 bg-white focus:ring-2 focus:ring-sky-500/20 flex-1 md:flex-none"
              value={filterProfessionalId}
              onChange={e => setFilterProfessionalId(e.target.value)}
            >
              <option value="">Profissionais</option>
              {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select 
              className="text-xs border border-slate-200 rounded-xl py-2 px-3 bg-white focus:ring-2 focus:ring-sky-500/20 flex-1 md:flex-none"
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
            >
              <option value="">Status</option>
              <option value="scheduled">Agendado</option>
              <option value="waiting">Aguardando</option>
              <option value="completed">Concluído</option>
              <option value="no-show">Faltou</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="btn-primary w-full md:w-auto py-2 h-auto"
          >
            <Plus size={18} />
            Agendar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Day Slots View */}
        <div className="lg:col-span-3 space-y-4">
          <div className="medical-card">
            <div className="divide-y divide-slate-100">
              {timeSlots.map((slot) => {
                const appAtSlot = filteredAppointments.find(app => {
                  const appTime = app.startTime.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  return appTime === slot;
                });

                const isMyApp = appAtSlot?.professionalId === profile?.uid;
                
                const patient = patients.find(p => p.id === appAtSlot?.patientId);
                const professional = professionals.find(p => p.id === appAtSlot?.professionalId);

                return (
                  <div key={slot} className="flex min-h-[80px] group">
                    <div className="w-20 py-4 px-4 text-xs font-bold text-slate-400 border-r border-slate-100 flex items-start justify-center">
                      {slot}
                    </div>
                    <div className="flex-1 p-2">
                      {appAtSlot ? (
                        <div className={`
                          h-full rounded-xl border p-3 flex items-center justify-between transition-all
                          ${isMyApp ? 'bg-sky-50 border-sky-200 ring-2 ring-sky-500/10' : 'bg-slate-50 border-slate-100'}
                          ${appAtSlot.status === 'completed' ? 'opacity-60 grayscale-[0.5]' : ''}
                        `}>
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-sm ${
                              isMyApp ? 'bg-sky-600 text-white' : 'bg-white text-slate-400'
                            }`}>
                              {patient?.name.charAt(0) || '?'}
                            </div>
                            <div>
                              <p className={`font-bold text-sm ${isMyApp ? 'text-sky-900' : 'text-slate-800'}`}>
                                {patient?.name || 'Paciente'}
                              </p>
                              <div className="flex items-center gap-3 mt-1">
                                <span className={`flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold ${isMyApp ? 'text-sky-600' : 'text-slate-500'}`}>
                                  <Stethoscope size={10} />
                                  {isMyApp ? 'Minha Consulta' : (professional?.name || 'Profissional')}
                                </span>
                                <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold opacity-60">
                                  <Clock size={10} />
                                  {slot} - {appAtSlot.endTime.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                              {/* Status Indicator Dot */}
                              <div className={`w-3 h-3 rounded-full ${
                                appAtSlot.status === 'completed' ? 'bg-emerald-500' :
                                appAtSlot.status === 'waiting' ? 'bg-amber-500' :
                                'bg-sky-400'
                              }`} title={
                                appAtSlot.status === 'completed' ? 'Concluído' :
                                appAtSlot.status === 'waiting' ? 'Aguardando' :
                                'Agendado'
                              } />
                             
                             <div className="relative">
                               <button 
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   setOpenMenuId(openMenuId === appAtSlot.id ? null : appAtSlot.id);
                                 }}
                                 className="p-2 hover:bg-sky-100 rounded-lg text-sky-400 transition-colors active:scale-95"
                               >
                                 <MoreVertical size={18} />
                               </button>
                               {openMenuId === appAtSlot.id && (
                                 <>
                                   <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                                   <div className="absolute right-0 top-full pt-1 z-50 min-w-[160px]">
                                     <div className="bg-white shadow-xl rounded-xl border border-slate-200 py-2 animate-in fade-in zoom-in duration-200 origin-top-right">
                                       <button 
                                         onClick={() => {
                                           handleEdit(appAtSlot);
                                           setOpenMenuId(null);
                                         }}
                                         className="w-full text-left px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                                       >
                                         Editar
                                       </button>
                                       <button 
                                         onClick={() => {
                                           handleUpdateStatus(appAtSlot.id, 'waiting');
                                           setOpenMenuId(null);
                                         }}
                                         className="w-full text-left px-4 py-2.5 text-sm font-semibold text-amber-600 hover:bg-slate-50 transition-colors"
                                       >
                                         Confirmar Presença
                                       </button>
                                       <button 
                                         onClick={() => {
                                           handleUpdateStatus(appAtSlot.id, 'completed');
                                           setOpenMenuId(null);
                                         }}
                                         className="w-full text-left px-4 py-2.5 text-sm font-semibold text-emerald-600 hover:bg-slate-50 transition-colors"
                                       >
                                         Concluir
                                       </button>
                                       <div className="border-t border-slate-100 my-1"></div>
                                       <button 
                                         onClick={() => {
                                           setDeleteConfirmId(appAtSlot.id);
                                           setOpenMenuId(null);
                                         }}
                                         className="w-full text-left px-4 py-2.5 text-sm font-semibold text-rose-600 hover:bg-slate-50 transition-colors"
                                       >
                                         Excluir
                                       </button>
                                     </div>
                                   </div>
                                 </>
                               )}
                             </div>
                          </div>
                        </div>
                      ) : (
                        <button 
                          onClick={() => {
                            setNewApp({...newApp, time: slot});
                            setIsModalOpen(true);
                          }}
                          className="w-full h-full border border-dashed border-slate-200 rounded-xl hover:border-sky-300 hover:bg-sky-50/50 transition-all flex items-center justify-center text-slate-300 hover:text-sky-400 font-medium text-sm"
                        >
                          Livre
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Confirmation Modal */}
        {deleteConfirmId && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl transition-all">
              <h3 className="text-lg font-bold text-slate-900 mb-2">Excluir Agendamento?</h3>
              <p className="text-sm text-slate-500 mb-6">Tem certeza que deseja remover este agendamento da agenda?</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteConfirmId(null)} className="flex-1 btn-secondary">Não, Manter</button>
                <button 
                  onClick={() => handleDeleteAppointment(deleteConfirmId)} 
                  className="flex-1 py-2 rounded-xl bg-rose-600 text-white font-bold text-sm hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/20"
                >
                  Sim, Excluir
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Calendar Sidebar Stats Stats */}
        <div className="space-y-6">
          <div className="medical-card p-6">
            <h3 className="font-bold text-slate-900 mb-4">Resumo do Dia</h3>
            <div className="space-y-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Agendamentos</span>
                <span className="font-bold text-slate-900">{filteredAppointments.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Concluídos</span>
                <span className="font-bold text-emerald-600">{filteredAppointments.filter(a => a.status === 'completed').length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Aguardando</span>
                <span className="font-bold text-amber-600">{filteredAppointments.filter(a => a.status === 'waiting').length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Agendados</span>
                <span className="font-bold text-sky-600">{filteredAppointments.filter(a => a.status === 'scheduled').length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Appointment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">Agendar Consulta</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <Plus className="rotate-45" size={24} />
              </button>
            </div>
            <form onSubmit={handleAddAppointment} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Paciente</label>
                <select 
                  required className="input-field"
                  value={newApp.patientId}
                  onChange={e => setNewApp({...newApp, patientId: e.target.value})}
                >
                  <option value="">Selecione um paciente</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Profissional</label>
                <select 
                  required className="input-field"
                  value={newApp.professionalId}
                  onChange={e => setNewApp({...newApp, professionalId: e.target.value})}
                >
                  <option value="">Selecione um profissional</option>
                  {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Horário</label>
                  <input 
                    type="time" required className="input-field" 
                    value={newApp.time} onChange={e => setNewApp({...newApp, time: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Atendimento</label>
                  <input 
                    type="text" required className="input-field" 
                    value={newApp.type} onChange={e => setNewApp({...newApp, type: e.target.value})}
                  />
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 btn-secondary">Cancelar</button>
                <button type="submit" className="flex-1 btn-primary">Agendar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
