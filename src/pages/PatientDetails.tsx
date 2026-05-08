import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  doc, 
  getDoc, 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  addDoc, 
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  ArrowLeft,
  Plus, 
  FileText, 
  History, 
  User, 
  Calendar as CalendarIcon,
  Save,
  Trash2,
  Download,
  MoreVertical,
  Printer,
  Stethoscope
} from 'lucide-react';
import { Patient, MedicalRecord } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { updateDoc, deleteDoc } from 'firebase/firestore';

export function PatientDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { clinic, profile } = useAuth();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingRecord, setIsAddingRecord] = useState(false);
  const [newRecordContent, setNewRecordContent] = useState('');
  const [recordCategory, setRecordCategory] = useState<'evolution' | 'evaluation'>('evolution');
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  
  // Export states
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  
  // Future appointments
  const [futureAppointments, setFutureAppointments] = useState<any[]>([]);
  
  // Edit Patient modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    birthDate: ''
  });

  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, type: 'patient' | 'record' } | null>(null);

  const [financialTransactions, setFinancialTransactions] = useState<any[]>([]);

  const fetchData = async () => {
    if (!id || !clinic) return;
    try {
      const pDoc = await getDoc(doc(db, 'patients', id));
      if (pDoc.exists()) {
        const data = pDoc.id ? { id: pDoc.id, ...pDoc.data() } as Patient : null;
        if (data) {
          setPatient(data);
          setEditForm({
            name: data.name,
            email: data.email,
            phone: data.phone,
            birthDate: data.birthDate
          });
        }
      }

      const q = query(
        collection(db, 'medicalRecords'), 
        where('clinicId', '==', clinic.id),
        where('patientId', '==', id)
      );
      const snap = await getDocs(q);
      setRecords(snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as MedicalRecord))
        .sort((a, b) => {
          const dateA = (a.date as any).seconds || new Date(a.date).getTime();
          const dateB = (b.date as any).seconds || new Date(b.date).getTime();
          return dateB - dateA;
        })
      );

      // Future appointments (filter in memory to avoid index error)
      const startOfToday = new Date();
      startOfToday.setHours(0,0,0,0);
      
      const fq = query(
        collection(db, 'appointments'),
        where('clinicId', '==', clinic.id),
        where('patientId', '==', id)
      );
      const fSnap = await getDocs(fq);
      setFutureAppointments(fSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as any))
        .filter(app => {
          const d = app.startTime?.toDate();
          return d >= startOfToday;
        })
        .sort((a, b) => a.startTime.seconds - b.startTime.seconds)
      );

      // Financial Transactions for this patient
      const finSnap = await getDocs(query(
        collection(db, 'financialTransactions'),
        where('clinicId', '==', clinic.id),
        where('patientId', '==', id)
      ));
      setFinancialTransactions(finSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as any))
        .sort((a, b) => {
          const dateA = (a.date as any).seconds || new Date(a.date).getTime();
          const dateB = (b.date as any).seconds || new Date(b.date).getTime();
          return dateB - dateA;
        })
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'patients/details');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      await updateDoc(doc(db, 'patients', id), {
        ...editForm,
        updatedAt: serverTimestamp()
      });
      setIsEditModalOpen(false);
      fetchData();
    } catch (err: any) {
      console.error('Error updating patient:', err);
      alert('Erro ao atualizar paciente: ' + err.message);
    }
  };

  const handleDeletePatient = async () => {
    if (!id) return;
    try {
      await deleteDoc(doc(db, 'patients', id));
      setDeleteConfirm(null);
      navigate('/patients');
    } catch (err: any) {
      console.error('Error deleting patient:', err);
      alert('Erro ao excluir paciente: ' + err.message);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id, clinic]);

  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !clinic || !profile || !newRecordContent) return;

    try {
      if (editingRecordId) {
        await updateDoc(doc(db, 'medicalRecords', editingRecordId), {
          content: newRecordContent,
          category: recordCategory,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'medicalRecords'), {
          patientId: id,
          professionalId: profile.uid,
          professionalName: profile.displayName,
          content: newRecordContent,
          category: recordCategory,
          clinicId: clinic.id,
          date: serverTimestamp()
        });
      }
      setIsAddingRecord(false);
      setEditingRecordId(null);
      setNewRecordContent('');
      fetchData();
    } catch (err) {
      console.error('Error saving record:', err);
    }
  };

  const handleDeleteRecord = async (recordId: string) => {
    try {
      await deleteDoc(doc(db, 'medicalRecords', recordId));
      setDeleteConfirm(null);
      fetchData();
    } catch (err: any) { 
      console.error(err);
      alert('Erro ao excluir prontuário: ' + (err.code === 'permission-denied' ? 'Acesso negado' : err.message));
    }
  };

  const handleEditRecord = (record: MedicalRecord) => {
    setEditingRecordId(record.id);
    setNewRecordContent(record.content);
    setRecordCategory(record.category);
    setIsAddingRecord(true);
  };

  const handleExport = () => {
    const filtered = records.filter(r => {
      const d = r.date?.toDate() || new Date();
      if (exportStartDate && d < new Date(exportStartDate)) return false;
      if (exportEndDate && d > new Date(exportEndDate + 'T23:59:59')) return false;
      return true;
    });

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const logoHtml = clinic?.logoUrl ? `<img src="${clinic.logoUrl}" style="max-height: 60px; margin-bottom: 20px;">` : `<h1>${clinic?.name || 'XCLIN'}</h1>`;

    printWindow.document.write(`
      <html>
        <head>
          <title>Prontuário - ${patient?.name}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #333; }
            .header { text-align: center; border-bottom: 2px solid #333; margin-bottom: 30px; padding-bottom: 20px; }
            .patient-info { margin-bottom: 30px; }
            .record { margin-bottom: 25px; border-bottom: 1px solid #eee; padding-bottom: 15px; }
            .date { font-weight: bold; color: #666; font-size: 0.9em; }
            .category { text-transform: uppercase; font-size: 0.7em; background: #eee; padding: 2px 6px; border-radius: 4px; margin-left: 10px; }
            .content { margin-top: 10px; line-height: 1.5; white-space: pre-wrap; }
            .footer { margin-top: 50px; font-size: 0.8em; text-align: center; color: #999; }
          </style>
        </head>
        <body>
          <div class="header">
            ${logoHtml}
            <h2>Relatório de Evolução Clínica</h2>
          </div>
          <div class="patient-info">
            <p><strong>Paciente:</strong> ${patient?.name}</p>
            <p><strong>Nascimento:</strong> ${new Date(patient?.birthDate || '').toLocaleDateString('pt-BR')}</p>
          </div>
          ${filtered.map(r => `
            <div class="record">
              <div>
                <span class="date">${r.date?.toDate().toLocaleString('pt-BR')}</span>
                <span class="category">${r.category === 'evolution' ? 'Evolução' : 'Avaliação'}</span>
              </div>
              <div class="content">${r.content}</div>
              <div style="font-size: 0.8em; color: #777; margin-top: 5px;">Profissional: ${r.professionalName}</div>
            </div>
          `).join('')}
          <div class="footer">
            Gerado em ${new Date().toLocaleString('pt-BR')} por XCLIN
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  if (loading) return <div className="p-8">Carregando prontuário...</div>;
  if (!patient) return <div className="p-8">Paciente não encontrado.</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate('/patients')}
          className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
        >
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{patient.name}</h1>
          <div className="flex items-center gap-4 text-sm text-slate-500 mt-1">
            <span className="flex items-center gap-1.5"><History size={14} /> {new Date().getFullYear() - new Date(patient.birthDate + 'T12:00:00').getFullYear()} anos</span>
            <span className="flex items-center gap-1.5"><CalendarIcon size={14} /> Nascido em {patient.birthDate.split('-').reverse().join('/')}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sidebar Info */}
        <div className="space-y-6">
          <div className="medical-card p-6">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <User size={18} className="text-sky-600" />
              Informações do Paciente
            </h3>
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-slate-400 mb-1">E-mail</p>
                <p className="text-slate-700 font-medium">{patient.email}</p>
              </div>
              <div>
                <p className="text-slate-400 mb-1">Telefone</p>
                <p className="text-slate-700 font-medium">{patient.phone}</p>
              </div>
              <div className="pt-4 flex gap-2">
                <button 
                  onClick={() => setIsEditModalOpen(true)}
                  className="flex-1 btn-secondary text-xs py-2"
                >
                  Editar Cadastro
                </button>
                <button 
                  onClick={() => setDeleteConfirm({ id: patient.id, type: 'patient' })}
                  className="p-2 border border-rose-200 text-rose-500 rounded-lg hover:bg-rose-50 transition-colors"
                  title="Excluir Paciente"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
          
          <div className="medical-card p-6 bg-white border border-slate-100 shadow-sm">
            <h3 className="font-bold mb-4 flex items-center gap-2 text-slate-900">
              <CalendarIcon size={18} className="text-sky-600" />
              Próximas Consultas
            </h3>
            {futureAppointments.length > 0 ? (
              <div className="space-y-3">
                {futureAppointments.slice(0, 3).map(app => (
                  <div key={app.id} className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-xs text-slate-700">
                    <p className="font-bold text-slate-900">{app.startTime.toDate().toLocaleDateString('pt-BR')}</p>
                    <p className="text-slate-500 font-medium">{app.startTime.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {app.type}</p>
                    <p className="mt-1 flex items-center gap-1 text-slate-400 font-medium">
                      <Stethoscope size={10} />
                      {app.professionalName}
                    </p>
                  </div>
                ))}
                <button 
                  onClick={() => navigate('/calendar')}
                  className="w-full text-center text-xs font-bold pt-2 text-sky-600 hover:text-sky-700 transition-colors"
                >
                  Ver Agenda Completa
                </button>
              </div>
            ) : (
              <>
                <p className="text-slate-500 text-sm mb-4">Ainda não há agendamentos futuros para este paciente.</p>
                <button 
                  onClick={() => navigate('/calendar')}
                  className="w-full bg-sky-600 hover:bg-sky-700 text-white font-medium py-2 rounded-lg text-sm transition-colors shadow-lg shadow-sky-600/20"
                >
                  Agendar Agora
                </button>
              </>
            )}
          </div>

          <div className="medical-card p-6 bg-white border border-slate-100 shadow-sm">
            <h3 className="font-bold mb-4 flex items-center gap-2 text-slate-900">
              <History size={18} className="text-emerald-600" />
              Financeiro
            </h3>
            {financialTransactions.length > 0 ? (
              <div className="space-y-3">
                {financialTransactions.slice(0, 5).map(t => (
                  <div key={t.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 text-xs text-slate-700">
                    <div>
                      <p className="font-bold">{t.date.toDate().toLocaleDateString('pt-BR')}</p>
                      <p className="text-slate-500">{t.category}</p>
                    </div>
                    <span className={`font-bold ${t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
                <button 
                  onClick={() => navigate('/financial')}
                  className="w-full text-center text-xs font-bold pt-2 text-emerald-600 hover:text-emerald-700 transition-colors"
                >
                  Ver Tudo
                </button>
              </div>
            ) : (
              <p className="text-slate-500 text-sm">Nenhum lançamento financeiro para este paciente.</p>
            )}
          </div>
        </div>

        {/* Medical History */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-900">Histórico de Evolução</h3>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
          >
            <Download size={18} />
            Exportar
          </button>
          <button 
            onClick={() => setIsAddingRecord(!isAddingRecord)}
            className="btn-primary py-2 text-sm"
          >
            {isAddingRecord ? (
              <>Cancelar</>
            ) : (
              <>
                <Plus size={18} />
                Nova Evolução
              </>
            )}
          </button>
        </div>
          </div>

          <AnimatePresence>
            {isAddingRecord && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <form onSubmit={handleSaveRecord} className="medical-card p-6 border-sky-200 bg-sky-50/30 space-y-4">
                  <div className="flex items-center gap-4 mb-2">
                    <button 
                      type="button"
                      onClick={() => setRecordCategory('evolution')}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${recordCategory === 'evolution' ? 'bg-sky-600 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}
                    >
                      Evolução
                    </button>
                    <button 
                      type="button"
                      onClick={() => setRecordCategory('evaluation')}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${recordCategory === 'evaluation' ? 'bg-sky-600 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}
                    >
                      Avaliação
                    </button>
                  </div>
                  <textarea 
                    className="w-full bg-white border border-slate-200 rounded-xl p-4 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all min-h-[150px]"
                    placeholder="Descreva a evolução do paciente nesta sessão..."
                    value={newRecordContent}
                    onChange={(e) => setNewRecordContent(e.target.value)}
                    required
                  />
                  <div className="flex justify-end pt-2">
                    <button type="submit" className="btn-primary">
                      <Save size={18} />
                      Salvar Prontuário
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-slate-200 before:via-slate-200 before:to-transparent">
            {records.length === 0 ? (
              <div className="medical-card p-12 text-center text-slate-400 relative ml-12">
                Nenhum registro encontrado para este paciente.
              </div>
            ) : (
              records.map((record) => (
                <div key={record.id} className="relative flex items-start group ml-12 lg:ml-0">
                  <div className="absolute -left-12 mt-1.5 w-4 h-4 rounded-full border-4 border-white bg-sky-500 shadow-sm z-10 hidden lg:block" style={{ marginLeft: '17px' }}></div>
                  <div className="medical-card p-6 space-y-4 w-full">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 text-slate-500 rounded-lg">
                          <FileText size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 capitalize">{record.category === 'evolution' ? 'Evolução' : 'Avaliação'}</p>
                          <p className="text-xs text-slate-500">
                            {record.date?.toDate().toLocaleDateString('pt-BR')} às {record.date?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Profissional</p>
                          <p className="text-xs text-slate-600 font-medium">{(record as any).professionalName || 'Profissional'}</p>
                        </div>
                        <div className="relative group/menu">
                          <button className="p-2 text-slate-300 hover:text-slate-600 transition-colors">
                            <MoreVertical size={18} />
                          </button>
                          <div className="absolute right-0 top-full pt-1 z-20 hidden group-hover/menu:block min-w-[120px]">
                            <div className="bg-white shadow-lg rounded-xl border border-slate-100 py-1">
                              <button 
                                onClick={() => handleEditRecord(record)}
                                className="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                              >
                                Editar
                              </button>
                              <button 
                                onClick={() => setDeleteConfirm({ id: record.id, type: 'record' })}
                                className="w-full text-left px-4 py-2 text-xs font-medium text-rose-600 hover:bg-slate-50 transition-colors"
                              >
                                Excluir
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap bg-slate-50/50 p-4 rounded-lg border border-slate-100">
                      {record.content}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl transition-all">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Excluir {deleteConfirm.type === 'patient' ? 'Paciente' : 'Registro'}?</h3>
            <p className="text-sm text-slate-500 mb-6">Tem certeza que deseja remover este item? Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 btn-secondary">Cancelar</button>
              <button 
                onClick={() => deleteConfirm.type === 'patient' ? handleDeletePatient() : handleDeleteRecord(deleteConfirm.id)} 
                className="flex-1 py-2 rounded-xl bg-rose-600 text-white font-bold text-sm hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/20"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Edit Patient Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">Editar Cadastro</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <Plus className="rotate-45" size={24} />
              </button>
            </div>
            <form onSubmit={handleUpdatePatient} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo</label>
                <input 
                  type="text" required className="input-field"
                  value={editForm.name}
                  onChange={e => setEditForm({...editForm, name: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
                  <input 
                    type="email" required className="input-field"
                    value={editForm.email}
                    onChange={e => setEditForm({...editForm, email: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Telefone / WhatsApp</label>
                  <input 
                    type="text" required className="input-field"
                    value={editForm.phone}
                    onChange={e => setEditForm({...editForm, phone: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Data de Nascimento</label>
                <input 
                  type="date" required className="input-field"
                  value={editForm.birthDate}
                  onChange={e => setEditForm({...editForm, birthDate: e.target.value})}
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 btn-secondary">Cancelar</button>
                <button type="submit" className="flex-1 btn-primary">Salvar Alterações</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {isExportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Exportar Prontuário</h3>
              <button onClick={() => setIsExportModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <Plus className="rotate-45" size={24} />
              </button>
            </div>
            <p className="text-sm text-slate-500">Selecione o período para exportar o histórico de evolução.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Deste a data:</label>
                <input 
                  type="date" className="input-field" 
                  value={exportStartDate} onChange={e => setExportStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Até a data:</label>
                <input 
                  type="date" className="input-field" 
                  value={exportEndDate} onChange={e => setExportEndDate(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setIsExportModalOpen(false)} className="flex-1 btn-secondary">Cancelar</button>
              <button onClick={handleExport} className="flex-1 btn-primary gap-2">
                <Printer size={18} />
                Imprimir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
