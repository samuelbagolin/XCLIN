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
import { db } from '../lib/firebase';
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

  const fetchData = async () => {
    if (!clinic) return;
    setLoading(true);
    try {
      // Appointments for selected day
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0,0,0,0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23,59,59,999);

      const q = query(
        collection(db, 'appointments'),
        where('clinicId', '==', clinic.id),
        where('startTime', '>=', Timestamp.fromDate(startOfDay)),
        where('startTime', '<=', Timestamp.fromDate(endOfDay)),
        orderBy('startTime', 'asc')
      );
      const snap = await getDocs(q);
      setAppointments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment)));

      // Patients & Professionals for dropdowns
      const pSnap = await getDocs(query(collection(db, 'patients'), where('clinicId', '==', clinic.id)));
      setPatients(pSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient)));

      const profSnap = await getDocs(query(collection(db, 'professionals'), where('clinicId', '==', clinic.id)));
      setProfessionals(profSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Professional)));
    } catch (err) {
      console.error('Error fetching calendar data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [clinic, selectedDate]);

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
      console.error('Error adding/updating appointment:', err);
    }
  };

  const handleUpdateStatus = async (id: string, status: Appointment['status']) => {
    try {
      await updateDoc(doc(db, 'appointments', id), { 
        status,
        updatedAt: serverTimestamp()
      });
      console.log(`Status updated to ${status} for ${id}`);
      fetchData();
    } catch (err: any) {
      console.error('Error updating status:', err);
      alert('Erro ao atualizar status: ' + err.message);
    }
  };

  const handleDeleteAppointment = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'appointments', id));
      setDeleteConfirmId(null);
      fetchData();
    } catch (err: any) {
      console.error('Error deleting appointment:', err);
      alert('Erro ao excluir agendamento: ' + err.message);
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
    <div className="space-y-6 transition-colors duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-sans transition-colors">Agenda</h1>
          <p className="text-slate-500 dark:text-slate-400 transition-colors">Acompanhe e gerencie as consultas da clínica.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center p-1 transition-colors">
            <button onClick={() => changeDate(-1)} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400"><ChevronLeft size={20} /></button>
            <div className="px-4 font-semibold text-slate-700 dark:text-slate-200 min-w-[150px] text-center text-sm sm:text-base">
              {selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
            </div>
            <button onClick={() => changeDate(1)} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400"><ChevronRight size={20} /></button>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="btn-primary"
          >
            <Plus size={18} />
            Agendar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Day Slots View */}
        <div className="lg:col-span-3 space-y-4 order-2 lg:order-1">
          <div className="medical-card">
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {timeSlots.map((slot) => {
                const appAtSlot = appointments.find(app => {
                  const appTime = app.startTime.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  return appTime === slot;
                });

                const isMyApp = appAtSlot?.professionalId === profile?.uid;
                
                const patient = patients.find(p => p.id === appAtSlot?.patientId);
                const professional = professionals.find(p => p.id === appAtSlot?.professionalId);

                return (
                  <div key={slot} className="flex min-h-[80px] group transition-colors">
                    <div className="w-16 sm:w-20 py-4 px-2 sm:px-4 text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 border-r border-slate-100 dark:border-slate-800 flex items-start justify-center transition-colors">
                      {slot}
                    </div>
                    <div className="flex-1 p-2">
                      {appAtSlot ? (
                        <div className={`
                          h-full rounded-xl border p-2 sm:p-3 flex items-center justify-between transition-all
                          ${isMyApp 
                            ? 'bg-sky-50 dark:bg-sky-900/10 border-sky-200 dark:border-sky-800 ring-2 ring-sky-500/10' 
                            : 'bg-slate-50 dark:bg-slate-800/20 border-slate-100 dark:border-slate-800'}
                          ${appAtSlot.status === 'completed' ? 'opacity-60 grayscale-[0.5]' : ''}
                        `}>
                          <div className="flex items-center gap-2 sm:gap-4 truncate">
                            <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full shrink-0 flex items-center justify-center font-bold shadow-sm transition-colors ${
                              isMyApp ? 'bg-sky-600 text-white' : 'bg-white dark:bg-slate-700 text-slate-400'
                            }`}>
                              {patient?.name.charAt(0) || '?'}
                            </div>
                            <div className="truncate">
                              <p className={`font-bold text-xs sm:text-sm truncate ${isMyApp ? 'text-sky-900 dark:text-sky-100' : 'text-slate-800 dark:text-slate-200'}`}>
                                {patient?.name || 'Paciente'}
                              </p>
                              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mt-0.5">
                                <span className={`flex items-center gap-1 text-[9px] sm:text-[10px] uppercase tracking-wider font-bold truncate ${isMyApp ? 'text-sky-600 dark:text-sky-400' : 'text-slate-500 dark:text-slate-400'}`}>
                                  <Stethoscope size={10} />
                                  {isMyApp ? 'Minha Consulta' : (professional?.name || 'Profissional')}
                                </span>
                                <span className="hidden sm:flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold opacity-60 dark:text-slate-400">
                                  <Clock size={10} />
                                  {slot} - {appAtSlot.endTime.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                              {/* Status Indicator Dot */}
                              <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full ${
                                appAtSlot.status === 'completed' ? 'bg-emerald-500' :
                                appAtSlot.status === 'waiting' ? 'bg-amber-500' :
                                'bg-sky-400'
                              }`} title={
                                appAtSlot.status === 'completed' ? 'Concluído' :
                                appAtSlot.status === 'waiting' ? 'Aguardando' :
                                'Agendado'
                              } />
                             
                             <div className="relative group/menu">
                               <button className="p-1 sm:p-2 hover:bg-sky-100 dark:hover:bg-slate-700 rounded-lg text-sky-400 dark:text-slate-500 transition-colors">
                                 <MoreVertical size={16} sm:size={18} />
                               </button>
                               <div className="absolute right-0 top-full pt-1 z-50 hidden group-hover/menu:block min-w-[150px]">
                                 <div className="bg-white dark:bg-slate-900 shadow-xl rounded-xl border border-slate-100 dark:border-slate-800 py-1 transition-colors">
                                   <button 
                                     onClick={() => handleEdit(appAtSlot)}
                                     className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                   >
                                     Editar
                                   </button>
                                   <button 
                                     onClick={() => handleUpdateStatus(appAtSlot.id, 'waiting')}
                                     className="w-full text-left px-4 py-2.5 text-xs font-semibold text-amber-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                   >
                                     Confirmar Presença (Aguardando)
                                   </button>
                                   <button 
                                     onClick={() => handleUpdateStatus(appAtSlot.id, 'completed')}
                                     className="w-full text-left px-4 py-2.5 text-xs font-semibold text-emerald-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                   >
                                     Concluir Consulta
                                   </button>
                                   <div className="border-t border-slate-100 dark:border-slate-800 my-1"></div>
                                   <button 
                                     onClick={() => setDeleteConfirmId(appAtSlot.id)}
                                     className="w-full text-left px-4 py-2.5 text-xs font-semibold text-rose-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                   >
                                     Excluir
                                   </button>
                                 </div>
                               </div>
                             </div>
                          </div>
                        </div>
                      ) : (
                        <button 
                          onClick={() => {
                            setNewApp({...newApp, time: slot});
                            setIsModalOpen(true);
                          }}
                          className="w-full h-full min-h-[60px] border border-dashed border-slate-200 dark:border-slate-700 rounded-xl hover:border-sky-300 dark:hover:border-sky-600 hover:bg-sky-50/50 dark:hover:bg-slate-800/30 transition-all flex items-center justify-center text-slate-300 dark:text-slate-600 hover:text-sky-400 font-bold text-xs sm:text-sm uppercase tracking-wide"
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
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl transition-all">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 font-sans">Excluir Agendamento?</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 font-sans">Tem certeza que deseja remover este agendamento da agenda?</p>
              <div className="flex gap-3 font-sans">
                <button onClick={() => setDeleteConfirmId(null)} className="flex-1 btn-secondary">Cancelar</button>
                <button 
                  onClick={() => handleDeleteAppointment(deleteConfirmId)} 
                  className="flex-1 py-2 rounded-xl bg-rose-600 text-white font-bold text-sm hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/20"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Calendar Sidebar Stats */}
        <div className="space-y-6 order-1 lg:order-2">
          <div className="medical-card p-6 bg-white dark:bg-slate-900 transition-colors">
            <h3 className="font-bold text-slate-900 dark:text-white mb-4 font-sans tracking-tight">Resumo do Dia</h3>
            <div className="space-y-4 text-xs sm:text-sm font-sans">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Agendamentos</span>
                <span className="font-bold text-slate-900 dark:text-white">{appointments.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Concluídos</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{appointments.filter(a => a.status === 'completed').length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Aguardando</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">{appointments.filter(a => a.status === 'waiting').length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Agendados</span>
                <span className="font-bold text-sky-600 dark:text-sky-400">{appointments.filter(a => a.status === 'scheduled').length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Appointment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-lg w-full overflow-hidden my-auto transition-colors">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white font-sans">Agendar Consulta</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <Plus className="rotate-45" size={24} />
              </button>
            </div>
            <form onSubmit={handleAddAppointment} className="p-6 space-y-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 transition-colors">Paciente</label>
                  <select 
                    required className="input-field w-full bg-white dark:bg-slate-900" 
                    value={newApp.patientId}
                    onChange={e => setNewApp({...newApp, patientId: e.target.value})}
                  >
                    <option value="">Selecione um paciente</option>
                    {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 transition-colors">Profissional</label>
                  <select 
                    required className="input-field w-full bg-white dark:bg-slate-900" 
                    value={newApp.professionalId}
                    onChange={e => setNewApp({...newApp, professionalId: e.target.value})}
                  >
                    <option value="">Selecione um profissional</option>
                    {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 transition-colors">Horário</label>
                    <input 
                      type="time" required className="input-field w-full" 
                      value={newApp.time} onChange={e => setNewApp({...newApp, time: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 transition-colors">Tipo de Atendimento</label>
                    <input 
                      type="text" required className="input-field w-full" 
                      value={newApp.type} onChange={e => setNewApp({...newApp, type: e.target.value})}
                    />
                  </div>
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
