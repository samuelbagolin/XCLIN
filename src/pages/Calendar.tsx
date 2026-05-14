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
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { Appointment, Patient, Professional } from '../types';
import { motion, AnimatePresence } from 'motion/react';


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
    type: 'Consulta',
    recurrence: {
      frequency: 'none' as any,
      interval: 1,
      until: '',
      count: 0
    }
  });

  const [recurrenceOption, setRecurrenceOption] = useState('none');
  const [recurrenceEndType, setRecurrenceEndType] = useState('never'); // never, date, count
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [recurrenceCount, setRecurrenceCount] = useState(1);

  const recurrenceOptions = [
    { value: 'none', label: 'Não se repete' },
    { value: 'daily', label: 'Todos os dias' },
    { value: 'weekly', label: 'Semanalmente' },
    { value: 'monthly', label: 'Mensalmente' },
    { value: 'yearly', label: 'Anualmente' },
    { value: 'weekdays', label: 'Dias úteis (segunda a sexta)' },
  ];

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const [filterProfessionalId, setFilterProfessionalId] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  const [editSeriesMode, setEditSeriesMode] = useState<'none' | 'ask' | 'single' | 'following' | 'all'>('none');
  const [seriesAction, setSeriesAction] = useState<'edit' | 'delete' | null>(null);
  const [targetApp, setTargetApp] = useState<Appointment | null>(null);

  const generateRecurringDates = (start: Date, option: string, endType: string, endDate: string, endCount: number) => {
    const dates: Date[] = [new Date(start)];
    let current = new Date(start);
    
    // Default limit is 1 year from now if "never"
    const limitDate = endType === 'date' ? new Date(endDate + 'T23:59:59') : new Date(start);
    if (endType === 'never') {
      limitDate.setFullYear(limitDate.getFullYear() + 1);
    }
    
    const maxCount = endType === 'count' ? endCount : 365; // Max 1 year of daily
    
    while (dates.length < maxCount) {
      const next = new Date(current);
      if (option === 'daily') next.setDate(next.getDate() + 1);
      else if (option === 'weekly') next.setDate(next.getDate() + 7);
      else if (option === 'monthly') next.setMonth(next.getMonth() + 1);
      else if (option === 'yearly') next.setFullYear(next.getFullYear() + 1);
      else if (option === 'weekdays') {
        next.setDate(next.getDate() + 1);
        while (next.getDay() === 0 || next.getDay() === 6) {
          next.setDate(next.getDate() + 1);
        }
      }
      else break;

      if (endType === 'date' && next > limitDate) break;
      if (endType === 'never' && next > limitDate) break;

      dates.push(new Date(next));
      current = new Date(next);
    }
    return dates;
  };

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

  const handleAddAppointment = async (e?: React.FormEvent, modeOverride?: any) => {
    if (e) e.preventDefault();
    if (!clinic || !newApp.patientId || !newApp.professionalId) return;

    const currentMode = modeOverride || editSeriesMode;

    try {
      const startTime = new Date(selectedDate);
      const [hours, minutes] = newApp.time.split(':').map(Number);
      startTime.setHours(hours, minutes, 0, 0);
      
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + 50);

      const patient = patients.find(p => p.id === newApp.patientId);
      const professional = professionals.find(p => p.id === newApp.professionalId);

      if (editingAppId) {
        // Handle recurrence edit question if it was recurring
        const app = filteredAppointments.find(a => a.id === editingAppId);
        if (app?.recurrenceId && currentMode === 'ask') {
          setTargetApp(app);
          setSeriesAction('edit');
          return;
        }

        const updateData: any = {
          patientId: newApp.patientId,
          patientName: patient?.name || '',
          professionalId: newApp.professionalId,
          professionalName: professional?.name || '',
          startTime: Timestamp.fromDate(startTime),
          endTime: Timestamp.fromDate(endTime),
          type: newApp.type,
          updatedAt: serverTimestamp()
        };

        if (currentMode === 'single' || !app?.recurrenceId) {
          await updateDoc(doc(db, 'appointments', editingAppId), updateData);
        } else if (currentMode === 'following') {
          // Update all future instances in series
          const q = query(
            collection(db, 'appointments'),
            where('recurrenceId', '==', app.recurrenceId),
            where('startTime', '>=', app.startTime)
          );
          const snap = await getDocs(q);
          const batchPromises = snap.docs.map(d => {
            // Adjust time but keep date of instance
            const instStart = d.data().startTime.toDate();
            const newInstStart = new Date(instStart);
            newInstStart.setHours(hours, minutes, 0, 0);
            const newInstEnd = new Date(newInstStart);
            newInstEnd.setMinutes(newInstEnd.getMinutes() + 50);

            return updateDoc(doc(db, 'appointments', d.id), {
              ...updateData,
              startTime: Timestamp.fromDate(newInstStart),
              endTime: Timestamp.fromDate(newInstEnd)
            });
          });
          await Promise.all(batchPromises);
        } else if (currentMode === 'all') {
          const q = query(collection(db, 'appointments'), where('recurrenceId', '==', app.recurrenceId));
          const snap = await getDocs(q);
          const batchPromises = snap.docs.map(d => {
            const instStart = d.data().startTime.toDate();
            const newInstStart = new Date(instStart);
            newInstStart.setHours(hours, minutes, 0, 0);
            const newInstEnd = new Date(newInstStart);
            newInstEnd.setMinutes(newInstEnd.getMinutes() + 50);

            return updateDoc(doc(db, 'appointments', d.id), {
              ...updateData,
              startTime: Timestamp.fromDate(newInstStart),
              endTime: Timestamp.fromDate(newInstEnd)
            });
          });
          await Promise.all(batchPromises);
        }
      } else {
        const generatedRecurrenceId = recurrenceOption !== 'none' ? Math.random().toString(36).substring(7) : null;
        
        if (recurrenceOption === 'none') {
          const payload: any = {
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
          };
          await addDoc(collection(db, 'appointments'), payload);
        } else {
          const dates = generateRecurringDates(startTime, recurrenceOption, recurrenceEndType, recurrenceEndDate, recurrenceCount);
          const promises = dates.map(date => {
            const instEnd = new Date(date);
            instEnd.setMinutes(instEnd.getMinutes() + 50);
            
            const payload: any = {
              patientId: newApp.patientId,
              patientName: patient?.name || '',
              professionalId: newApp.professionalId,
              professionalName: professional?.name || '',
              startTime: Timestamp.fromDate(date),
              endTime: Timestamp.fromDate(instEnd),
              status: 'scheduled',
              type: newApp.type,
              clinicId: clinic.id,
              recurrenceId: generatedRecurrenceId,
              recurrenceRule: {
                frequency: recurrenceOption,
                interval: 1,
                until: recurrenceEndType === 'date' ? Timestamp.fromDate(new Date(recurrenceEndDate + 'T23:59:59')) : null,
                count: recurrenceEndType === 'count' ? recurrenceCount : null
              },
              createdAt: serverTimestamp()
            };
            return addDoc(collection(db, 'appointments'), payload);
          });
          await Promise.all(promises);
        }
      }

      setIsModalOpen(false);
      setEditingAppId(null);
      setEditSeriesMode('none');
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

  const handleDeleteAppointment = async (id: string, modeOverride?: any) => {
    const app = appointments.find(a => a.id === id);
    const currentMode = modeOverride || editSeriesMode;

    if (app?.recurrenceId && currentMode === 'none') {
      setTargetApp(app);
      setSeriesAction('delete');
      return;
    }

    try {
      if (currentMode === 'single' || !app?.recurrenceId) {
        await deleteDoc(doc(db, 'appointments', id));
      } else if (currentMode === 'following') {
        const q = query(
          collection(db, 'appointments'),
          where('recurrenceId', '==', app.recurrenceId),
          where('startTime', '>=', app.startTime)
        );
        const snap = await getDocs(q);
        const batchPromises = snap.docs.map(d => deleteDoc(doc(db, 'appointments', d.id)));
        await Promise.all(batchPromises);
      } else if (currentMode === 'all') {
        const q = query(collection(db, 'appointments'), where('recurrenceId', '==', app.recurrenceId));
        const snap = await getDocs(q);
        const batchPromises = snap.docs.map(d => deleteDoc(doc(db, 'appointments', d.id)));
        await Promise.all(batchPromises);
      }

      setDeleteConfirmId(null);
      setEditSeriesMode('none');
      setTargetApp(null);
      setSeriesAction(null);
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
      type: app.type,
      recurrence: {
        frequency: app.recurrenceRule?.frequency || 'none',
        interval: app.recurrenceRule?.interval || 1,
        until: app.recurrenceRule?.until ? app.recurrenceRule.until.toDate().toISOString().split('T')[0] : '',
        count: app.recurrenceRule?.count || 0
      }
    });
    setRecurrenceOption(app.recurrenceRule?.frequency || 'none');
    if (app.recurrenceRule?.until) {
      setRecurrenceEndType('date');
      setRecurrenceEndDate(app.recurrenceRule.until.toDate().toISOString().split('T')[0]);
    } else if (app.recurrenceRule?.count) {
      setRecurrenceEndType('count');
      setRecurrenceCount(app.recurrenceRule.count);
    } else {
      setRecurrenceEndType('never');
    }
    
    if (app.recurrenceId) {
      setEditSeriesMode('ask');
    } else {
      setEditSeriesMode('none');
    }

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
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">{editingAppId ? 'Editar Agendamento' : 'Agendar Consulta'}</h3>
              <button 
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingAppId(null);
                  setEditSeriesMode('none');
                }} 
                className="text-slate-400 hover:text-slate-600"
              >
                <Plus className="rotate-45" size={24} />
              </button>
            </div>
            <form onSubmit={handleAddAppointment} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
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

              <div className="border-t border-slate-100 pt-4 space-y-4">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <RefreshCw size={16} className="text-sky-600" />
                  Repetir Agendamento
                </div>
                
                <div>
                  <select 
                    className="input-field"
                    value={recurrenceOption}
                    onChange={e => setRecurrenceOption(e.target.value)}
                  >
                    {recurrenceOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {recurrenceOption !== 'none' && (
                  <div className="bg-slate-50 p-4 rounded-2xl space-y-4 animate-in slide-in-from-top-2 duration-200">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Termina em:</p>
                      <div className="flex flex-col gap-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="radio" 
                            name="endType" 
                            checked={recurrenceEndType === 'never'} 
                            onChange={() => setRecurrenceEndType('never')}
                            className="text-sky-600 focus:ring-sky-500"
                          />
                          <span className="text-sm text-slate-700">Nunca</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="radio" 
                            name="endType" 
                            checked={recurrenceEndType === 'date'} 
                            onChange={() => setRecurrenceEndType('date')}
                            className="text-sky-600 focus:ring-sky-500"
                          />
                          <span className="text-sm text-slate-700">Em uma data específica</span>
                        </label>
                        {recurrenceEndType === 'date' && (
                          <input 
                            type="date" 
                            className="input-field mt-1 py-2 text-sm"
                            value={recurrenceEndDate}
                            onChange={e => setRecurrenceEndDate(e.target.value)}
                            required
                          />
                        )}
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="radio" 
                            name="endType" 
                            checked={recurrenceEndType === 'count'} 
                            onChange={() => setRecurrenceEndType('count')}
                            className="text-sky-600 focus:ring-sky-500"
                          />
                          <span className="text-sm text-slate-700">Após X repetições</span>
                        </label>
                        {recurrenceEndType === 'count' && (
                          <div className="flex items-center gap-2 mt-1">
                            <input 
                              type="number" 
                              min="1"
                              className="input-field py-2 text-sm w-20"
                              value={recurrenceCount}
                              onChange={e => setRecurrenceCount(parseInt(e.target.value))}
                              required
                            />
                            <span className="text-xs text-slate-500 font-medium">ocorrências</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 btn-secondary">Cancelar</button>
                <button type="submit" className="flex-1 btn-primary">Agendar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Series Action Modal (Ask user) */}
      {(seriesAction === 'edit' || seriesAction === 'delete') && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[110] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6"
          >
            <div className="w-16 h-16 bg-sky-50 text-sky-600 rounded-2xl flex items-center justify-center mx-auto ring-8 ring-sky-50/50">
              <RefreshCw size={32} />
            </div>
            
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-bold text-slate-900">Evento Recorrente</h3>
              <p className="text-slate-500 text-sm">
                Deseja {seriesAction === 'edit' ? 'editar' : 'excluir'} apenas este evento ou toda a série?
              </p>
            </div>

            <div className="space-y-3">
              <button 
                onClick={() => {
                  setEditSeriesMode('single');
                  if (seriesAction === 'edit') {
                    handleAddAppointment(undefined, 'single');
                  } else {
                    handleDeleteAppointment(targetApp!.id, 'single');
                  }
                  setSeriesAction(null);
                }}
                className="w-full py-4 px-6 rounded-2xl border-2 border-slate-100 hover:border-sky-500 hover:bg-sky-50 text-left transition-all group"
              >
                <div className="font-bold text-slate-800">Este evento</div>
                <div className="text-xs text-slate-400">Apenas a ocorrência selecionada</div>
              </button>

              <button 
                onClick={() => {
                  setEditSeriesMode('following');
                  if (seriesAction === 'edit') {
                    handleAddAppointment(undefined, 'following');
                  } else {
                    handleDeleteAppointment(targetApp!.id, 'following');
                  }
                  setSeriesAction(null);
                }}
                className="w-full py-4 px-6 rounded-2xl border-2 border-slate-100 hover:border-sky-500 hover:bg-sky-50 text-left transition-all group"
              >
                <div className="font-bold text-slate-800">Este e os próximos</div>
                <div className="text-xs text-slate-400">Todas as ocorrências a partir desta data</div>
              </button>

              <button 
                onClick={() => {
                  setEditSeriesMode('all');
                  if (seriesAction === 'edit') {
                    handleAddAppointment(undefined, 'all');
                  } else {
                    handleDeleteAppointment(targetApp!.id, 'all');
                  }
                  setSeriesAction(null);
                }}
                className="w-full py-4 px-6 rounded-2xl border-2 border-slate-100 hover:border-sky-500 hover:bg-sky-50 text-left transition-all group"
              >
                <div className="font-bold text-slate-800">Toda a série</div>
                <div className="text-xs text-slate-400">Todas as ocorrências passadas e futuras</div>
              </button>
            </div>

            <div className="pt-4 flex gap-3">
              <button 
                onClick={() => {
                  setSeriesAction(null);
                  setEditSeriesMode('ask');
                  setTargetApp(null);
                }} 
                className="flex-1 py-3 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-2xl transition-colors"
              >
                Cancelar
              </button>
              {seriesAction === 'edit' && (
                <button 
                  onClick={() => {
                    // This button actually confirms the choice for edit
                    // The handleAddAppointment will be re-run by the user clicking "Salvar" in the modal
                    // but we want a smoother UX.
                    // If mode is set, handleAddAppointment will work.
                    setSeriesAction(null);
                  }}
                  className="flex-1 py-3 bg-sky-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-sky-600/20"
                >
                  Confirmar Escolha
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
