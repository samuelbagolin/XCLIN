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
  Edit2,
  Stethoscope,
  MessageSquare,
  FileCheck,
  ExternalLink,
  CheckCircle2
} from 'lucide-react';
import { Patient, MedicalRecord, Document } from '../types';
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
  const [activeTab, setActiveTab] = useState<'records' | 'agenda' | 'financial' | 'documents'>('records');
  const [patientDocuments, setPatientDocuments] = useState<Document[]>([]);
  
  // Export states
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  
  // Future appointments
  const [futureAppointments, setFutureAppointments] = useState<any[]>([]);
  
  // Edit Patient modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [includeAddress, setIncludeAddress] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    birthDate: '',
    type: 'adult' as 'adult' | 'child',
    cpf: '',
    fatherName: '',
    motherName: '',
    address: {
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: '',
      zipCode: ''
    }
  });

  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, type: 'patient' | 'record' } | null>(null);
  const [openRecordMenuId, setOpenRecordMenuId] = useState<string | null>(null);
  const [financialTransactions, setFinancialTransactions] = useState<any[]>([]);
  const [docToDelete, setDocToDelete] = useState<Document | null>(null);

  const getSignatureUrl = (id: string) => `${window.location.origin}/sign/${id}`;

  const handleSendMessage = (document: Document) => {
    const url = getSignatureUrl(document.id);
    const message = `Olá ${document.patientName}, seu documento (${document.title}) está disponível para assinatura no link abaixo:\n\n${url}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleDeleteDocument = async (docId: string) => {
    try {
      await deleteDoc(doc(db, 'documents', docId));
      setDocToDelete(null);
      fetchData();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'documents');
    }
  };

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
            email: data.email || '',
            phone: data.phone || '',
            birthDate: data.birthDate || '',
            type: data.type || 'adult',
            cpf: data.cpf || '',
            fatherName: data.fatherName || '',
            motherName: data.motherName || '',
            address: data.address || { street: '', number: '', complement: '', neighborhood: '', city: '', state: '', zipCode: '' }
          });
          setIncludeAddress(!!data.address);
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

      // Documents (filter only, sort in memory to avoid index error)
      const docsQ = query(
        collection(db, 'documents'),
        where('patientId', '==', id)
      );
      const docsSnap = await getDocs(docsQ);
      setPatientDocuments(docsSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Document))
        .sort((a, b) => {
          const dateA = a.createdAt?.toMillis() || 0;
          const dateB = b.createdAt?.toMillis() || 0;
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
        address: includeAddress ? editForm.address : null,
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

  const handlePrintSession = (record: MedicalRecord) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const logoHtml = clinic?.logoUrl ? `<img src="${clinic.logoUrl}" style="max-height: 60px; margin-bottom: 20px;">` : `<h1>${clinic?.name || 'XCLIN'}</h1>`;
    const rDate = record.date?.toDate() || new Date();

    printWindow.document.write(`
      <html>
        <head>
          <title>Sessão - ${patient?.name}</title>
          <style>
            body { font-family: sans-serif; padding: 50px; color: #333; line-height: 1.6; }
            .session-box { border: 1px solid #eee; padding: 40px; border-radius: 12px; max-width: 800px; margin: 0 auto; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
            .header { text-align: center; border-bottom: 2px solid #f1f5f9; margin-bottom: 30px; padding-bottom: 20px; }
            .patient-label { color: #64748b; font-size: 0.8em; text-transform: uppercase; font-weight: bold; margin-bottom: 4px; }
            .patient-name { font-size: 1.25em; font-weight: bold; color: #0f172a; margin-bottom: 20px; }
            .record-meta { display: flex; gap: 20px; margin-bottom: 30px; padding: 15px; background: #f8fafc; border-radius: 8px; font-size: 0.9em; }
            .content-box { min-height: 300px; padding: 20px; border: 1px solid #f1f5f9; border-radius: 8px; white-space: pre-wrap; font-size: 1em; color: #334155; }
            .footer { margin-top: 50px; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 20px; color: #94a3b8; font-size: 0.8em; }
            .signature-area { margin-top: 80px; display: flex; justify-content: center; }
            .signature-line { border-top: 1px solid #334155; min-width: 300px; text-align: center; padding-top: 10px; }
            @media print {
              body { padding: 20px; }
              .session-box { border: none; box-shadow: none; }
            }
          </style>
        </head>
        <body>
          <div class="session-box">
            <div class="header">
              ${logoHtml}
              <h2 style="color: #0284c7; margin: 10px 0;">REGISTRO DE ATENDIMENTO</h2>
            </div>
            <div class="patient-label">Paciente</div>
            <div class="patient-name">${patient?.name}</div>
            
            <div class="record-meta">
              <div><strong>DATA:</strong> ${rDate.toLocaleDateString('pt-BR')}</div>
              <div><strong>HORA:</strong> ${rDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              <div><strong>TIPO:</strong> ${record.category === 'evaluation' ? 'Avaliação' : 'Evolução'}</div>
            </div>

            <div class="patient-label">Evolução Clínica</div>
            <div class="content-box">${record.content}</div>

            <div class="signature-area">
              <div class="signature-line">
                <p style="margin: 0; font-weight: bold;">${record.professionalName}</p>
                <p style="margin: 0; font-size: 0.8em; color: #64748b;">Profissional Responsável</p>
              </div>
            </div>

            <div class="footer">
              Este documento é parte integrante do prontuário do paciente.<br>
              Gerado em ${new Date().toLocaleString('pt-BR')} por ${clinic?.name || 'Sistema de Gestão'}
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const calculateAge = (birthDate: string) => {
    if (!birthDate) return 0;
    const today = new Date();
    const [year, month, day] = birthDate.split('-').map(Number);
    const birth = new Date(year, month - 1, day);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
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
            <p><strong>Nascimento:</strong> ${patient?.birthDate ? patient.birthDate.split('-').reverse().join('/') : '---'}</p>
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
            <span className="flex items-center gap-1.5"><History size={14} /> {calculateAge(patient.birthDate)} anos</span>
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
              {patient.email && (
                <div>
                  <p className="text-slate-400 mb-1">E-mail</p>
                  <p className="text-slate-700 font-medium">{patient.email}</p>
                </div>
              )}
              {patient.cpf && (
                <div>
                  <p className="text-slate-400 mb-1">CPF</p>
                  <p className="text-slate-700 font-medium">{patient.cpf}</p>
                </div>
              )}
              {patient.phone && (
                <div>
                  <p className="text-slate-400 mb-1">Telefone</p>
                  <div className="flex items-center justify-between">
                    <p className="text-slate-700 font-medium">{patient.phone}</p>
                    <a 
                      href={`https://wa.me/${patient.phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200 transition-colors"
                      title="WhatsApp"
                    >
                      <MessageSquare size={16} />
                    </a>
                  </div>
                </div>
              )}
              {(patient.fatherName || patient.motherName) && (
                <div className="pt-2 border-t border-slate-50 space-y-3">
                  {patient.fatherName && (
                    <div>
                      <p className="text-slate-400 mb-0.5 uppercase text-[10px] font-bold">Pai</p>
                      <p className="text-slate-700 font-medium">{patient.fatherName}</p>
                    </div>
                  )}
                  {patient.motherName && (
                    <div>
                      <p className="text-slate-400 mb-0.5 uppercase text-[10px] font-bold">Mãe</p>
                      <p className="text-slate-700 font-medium">{patient.motherName}</p>
                    </div>
                  )}
                </div>
              )}
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
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
              {[
                { id: 'records', label: 'Evoluções & Avaliações' },
                { id: 'documents', label: 'Contratos & Documentos' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === tab.id ? 'bg-white text-sky-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              {activeTab === 'records' && (
                <>
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
                    {isAddingRecord ? 'Cancelar' : <><Plus size={18} /> Nova Evolução</>}
                  </button>
                </>
              )}
              {activeTab === 'documents' && (
                <button 
                  onClick={() => navigate('/documents')}
                  className="btn-primary py-2 text-sm"
                >
                  <Plus size={18} /> Novo Contrato
                </button>
              )}
            </div>
          </div>

          {activeTab === 'records' && (
            <>
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
                        <div className="relative">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenRecordMenuId(openRecordMenuId === record.id ? null : record.id);
                            }}
                            className="p-2 text-slate-300 hover:text-slate-600 transition-colors active:scale-95"
                          >
                            <MoreVertical size={18} />
                          </button>
                          {openRecordMenuId === record.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setOpenRecordMenuId(null)} />
                              <div className="absolute right-0 top-full pt-1 z-20 min-w-[120px]">
                                <div className="bg-white shadow-2xl rounded-2xl border border-slate-100 py-2 animate-in fade-in zoom-in duration-200 origin-top-right min-w-[180px]">
                                  <button 
                                    onClick={() => {
                                      handlePrintSession(record);
                                      setOpenRecordMenuId(null);
                                    }}
                                    className="w-full text-left px-4 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-sky-600 transition-all flex items-center gap-3"
                                  >
                                    <div className="p-1.5 bg-slate-50 rounded-lg group-hover:bg-sky-50 transition-colors">
                                      <Printer size={16} className="opacity-70" />
                                    </div>
                                    Imprimir Sessão
                                  </button>
                                  <button 
                                    onClick={() => {
                                      handleEditRecord(record);
                                      setOpenRecordMenuId(null);
                                    }}
                                    className="w-full text-left px-4 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-sky-600 transition-all flex items-center gap-3"
                                  >
                                    <div className="p-1.5 bg-slate-50 rounded-lg group-hover:bg-sky-50 transition-colors">
                                      <Edit2 size={16} className="opacity-70" />
                                    </div>
                                    Editar Registro
                                  </button>
                                  <div className="my-2 border-t border-slate-100 mx-2"></div>
                                  <button 
                                    onClick={() => {
                                      setDeleteConfirm({ id: record.id, type: 'record' });
                                      setOpenRecordMenuId(null);
                                    }}
                                    className="w-full text-left px-4 py-3 text-xs font-bold text-rose-600 hover:bg-rose-50 transition-all flex items-center gap-3"
                                  >
                                    <div className="p-1.5 bg-rose-50 rounded-lg group-hover:bg-rose-100 transition-colors">
                                      <Trash2 size={16} />
                                    </div>
                                    Excluir Evolução
                                  </button>
                                </div>
                              </div>
                            </>
                          )}
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
            </>
          )}

          {activeTab === 'documents' && (
            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 tracking-tight">Acervo de Documentos</h3>
                  <p className="text-xs text-slate-500 mt-1 font-medium italic">Gestão de formalização jurídica e contratual.</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left">
                      <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Documento</th>
                      <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Status</th>
                      <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Enviado</th>
                      <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Assinatura</th>
                      <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {patientDocuments.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-8 py-20 text-center">
                          <div className="max-w-xs mx-auto space-y-3">
                            <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto ring-4 ring-white shadow-sm">
                              <FileCheck size={32} />
                            </div>
                            <p className="text-slate-400 font-medium text-sm">Nenhum contrato gerado para este paciente ainda.</p>
                            <button onClick={() => navigate('/documents')} className="text-sky-600 text-xs font-bold hover:underline">Gerar primeiro contrato agora</button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      patientDocuments.map((doc) => (
                        <tr key={doc.id} className="group hover:bg-slate-50/50 transition-colors">
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-4">
                              <div className="w-11 h-11 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-sky-600 shadow-sm group-hover:shadow-md transition-shadow">
                                <FileCheck size={22} />
                              </div>
                              <div>
                                <p className="font-bold text-slate-900 group-hover:text-sky-600 transition-colors">{doc.title}</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Versão: {doc.id.slice(0, 8)}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex justify-center">
                              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                                doc.status === 'signed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 shadow-sm shadow-emerald-500/5' :
                                doc.status === 'viewed' ? 'bg-purple-50 text-purple-600 border-purple-100' :
                                'bg-slate-50 text-slate-500 border-slate-100'
                              }`}>
                                {doc.status === 'signed' ? (
                                  <span className="flex items-center gap-1.5"><CheckCircle2 size={12} /> Assinado</span>
                                ) : doc.status}
                              </span>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-2 text-slate-500 font-medium">
                              <CalendarIcon size={14} className="opacity-40" />
                              {doc.createdAt?.toDate().toLocaleDateString('pt-BR')}
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            {doc.signedAt ? (
                              <div className="space-y-1">
                                <div className="text-emerald-600 font-bold flex items-center gap-1">
                                  {doc.signedAt.toDate().toLocaleDateString('pt-BR')}
                                </div>
                                <p className="text-[10px] text-slate-400 font-bold uppercase truncate max-w-[120px]">IP: {doc.signatureIp}</p>
                              </div>
                            ) : (
                              <span className="text-slate-300 italic text-xs">Aguardando...</span>
                            )}
                          </td>
                          <td className="px-8 py-6 text-right">
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => window.open(`/sign/${doc.id}`, '_blank')}
                                className="p-3 bg-white border border-slate-100 text-slate-400 hover:text-sky-600 rounded-xl hover:shadow-lg transition-all"
                                title="Visualizar"
                              >
                                <ExternalLink size={18} />
                              </button>
                              <button 
                                onClick={() => handleSendMessage(doc)}
                                className="p-3 bg-white border border-slate-100 text-slate-400 hover:text-emerald-600 rounded-xl hover:shadow-lg transition-all"
                                title="Enviar via WhatsApp"
                              >
                                <MessageSquare size={18} />
                              </button>
                              <button 
                                onClick={() => setDocToDelete(doc)}
                                className="p-3 bg-white border border-slate-100 text-slate-400 hover:text-rose-600 rounded-xl hover:shadow-lg transition-all"
                                title="Excluir"
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
          )}
        </div>
      </div>

      {/* Document Delete Confirmation Modal */}
      {docToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in duration-300 text-center">
            <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6 ring-8 ring-rose-50/50">
              <AlertTriangle size={40} />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2 whitespace-nowrap uppercase tracking-tight">TEM CERTEZA?</h3>
            <p className="text-sm text-slate-500 mb-8 leading-relaxed">
              Deseja realmente excluir este documento? Essa ação não poderá ser desfeita e o link de assinatura será invalidado.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDocToDelete(null)} className="flex-1 btn-secondary py-3 text-sm">Cancelar</button>
              <button 
                onClick={() => handleDeleteDocument(docToDelete.id)} 
                className="flex-1 py-3 rounded-xl bg-rose-600 text-white font-bold text-sm hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/20 active:scale-95"
              >
                Excluir Documento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in duration-300 text-center">
            <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6 ring-8 ring-rose-50/50">
              <AlertTriangle size={40} />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2 whitespace-nowrap uppercase tracking-tight">TEM CERTEZA?</h3>
            <p className="text-sm text-slate-500 mb-8 leading-relaxed">
              {deleteConfirm.type === 'patient' 
                ? 'Este paciente e todo o seu histórico clínico serão removidos permanentemente.'
                : 'Esta evolução clínica será removida permanentemente.'}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 btn-secondary py-3">Cancelar</button>
              <button 
                onClick={() => deleteConfirm.type === 'patient' ? handleDeletePatient() : handleDeleteRecord(deleteConfirm.id)} 
                className="flex-1 py-3 rounded-xl bg-rose-600 text-white font-bold text-sm hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/20 active:scale-95"
              >
                Confirmar Exclusão
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
            <form onSubmit={handleUpdatePatient} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div 
                  onClick={() => setEditForm({...editForm, type: 'adult'})}
                  className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex flex-col items-center gap-2 ${editForm.type === 'adult' ? 'border-sky-500 bg-sky-50' : 'border-slate-100 hover:border-slate-200'}`}
                >
                  <span className="text-2xl">👨‍💼</span>
                  <span className={`text-xs font-bold ${editForm.type === 'adult' ? 'text-sky-700' : 'text-slate-500'}`}>Adulto</span>
                </div>
                <div 
                  onClick={() => setEditForm({...editForm, type: 'child'})}
                  className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex flex-col items-center gap-2 ${editForm.type === 'child' ? 'border-sky-500 bg-sky-50' : 'border-slate-100 hover:border-slate-200'}`}
                >
                  <span className="text-2xl">🧒</span>
                  <span className={`text-xs font-bold ${editForm.type === 'child' ? 'text-sky-700' : 'text-slate-500'}`}>Criança</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo</label>
                <input 
                  type="text" required className="input-field"
                  value={editForm.name}
                  onChange={e => setEditForm({...editForm, name: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">CPF (Opcional)</label>
                <input 
                  type="text" className="input-field"
                  value={editForm.cpf}
                  onChange={e => setEditForm({...editForm, cpf: e.target.value})}
                  placeholder="000.000.000-00"
                />
              </div>

              {editForm.type === 'child' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Pai</label>
                    <input 
                      type="text" className="input-field"
                      value={editForm.fatherName}
                      onChange={e => setEditForm({...editForm, fatherName: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Mãe</label>
                    <input 
                      type="text" className="input-field"
                      value={editForm.motherName}
                      onChange={e => setEditForm({...editForm, motherName: e.target.value})}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
                  <input 
                    type="email" className="input-field"
                    value={editForm.email}
                    onChange={e => setEditForm({...editForm, email: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">WhatsApp</label>
                  <input 
                    type="text" className="input-field"
                    value={editForm.phone}
                    onChange={e => setEditForm({...editForm, phone: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Data de Nascimento</label>
                <input 
                  type="date" className="input-field"
                  value={editForm.birthDate}
                  onChange={e => setEditForm({...editForm, birthDate: e.target.value})}
                />
              </div>

              {/* Address Toggle */}
              <div className="pt-2">
                <button 
                  type="button"
                  onClick={() => setIncludeAddress(!includeAddress)}
                  className={`flex items-center gap-2 text-sm font-semibold transition-colors ${includeAddress ? 'text-sky-600' : 'text-slate-500'}`}
                >
                  <div className={`w-10 h-5 rounded-full relative transition-colors ${includeAddress ? 'bg-sky-500' : 'bg-slate-300'}`}>
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-transform ${includeAddress ? 'translate-x-6' : 'translate-x-1'}`} />
                  </div>
                  Cadastrar Endereço?
                </button>
              </div>

              {includeAddress && (
                <div className="space-y-4 pt-2 border-t border-slate-50">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2">
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Logradouro</label>
                      <input 
                        type="text" className="input-field text-sm"
                        value={editForm.address.street} 
                        onChange={e => setEditForm({...editForm, address: {...editForm.address, street: e.target.value}})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nº</label>
                      <input 
                        type="text" className="input-field text-sm" 
                        value={editForm.address.number} 
                        onChange={e => setEditForm({...editForm, address: {...editForm.address, number: e.target.value}})}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Complemento</label>
                      <input 
                        type="text" className="input-field text-sm" 
                        value={editForm.address.complement} 
                        onChange={e => setEditForm({...editForm, address: {...editForm.address, complement: e.target.value}})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Bairro</label>
                      <input 
                        type="text" className="input-field text-sm" 
                        value={editForm.address.neighborhood} 
                        onChange={e => setEditForm({...editForm, address: {...editForm.address, neighborhood: e.target.value}})}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4 flex gap-3 sticky bottom-0 bg-white pb-2">
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
