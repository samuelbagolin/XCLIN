import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, addDoc, serverTimestamp, orderBy, onSnapshot, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  FileText, 
  Plus, 
  Search, 
  ChevronRight, 
  Send, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  ExternalLink,
  Users,
  School,
  AlertTriangle,
  ArrowLeft,
  Copy,
  Mail,
  MessageSquare,
  Printer,
  Trash2
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Document, Patient, DocumentType, DocumentStatus } from '../types';
import { motion, AnimatePresence } from 'motion/react';

const DOCUMENT_TEMPLATES = {
  service_contract: {
    title: 'Contrato de Atendimento Terapêutico',
    description: 'Contrato padrão para início de acompanhamento em clínica.',
    icon: <FileText className="text-sky-600" />,
    content: (p: Patient, c: any) => `CONTRATO DE PRESTAÇÃO DE SERVIÇOS TERAPÊUTICOS

1. IDENTIFICAÇÃO DAS PARTES
CONTRATADA: ${c?.name || '[NOME DA CLÍNICA]'}, sediada em ${c?.address || '[ENDEREÇO DA CLÍNICA]'}.
CONTRATANTE: ${p.name}, inscrito no CPF sob nº ${p.cpf || '________________'}, ${p.type === 'child' ? `responsável legal por ${p.name},` : ''} residente em ${p.address?.street || '________________'}, nº ${p.address?.number || '___'}.

2. OBJETO
O presente contrato tem por objeto a prestação de serviços de [TIPO DE TERAPIA], a ser realizado nas dependências da CONTRATADA.

3. FREQUÊNCIA E DURAÇÃO
As sessões terão duração de [50] minutos, com frequência de [1] vez(es) por semana, em horários previamente agendados.

4. VALORES E FORMA DE PAGAMENTO
O valor de cada sessão é de R$ [VALOR], devendo ser pago de forma [MENSAL/POR SESSÃO].

5. POLÍTICA DE FALTAS E CANCELAMENTOS
Eventual cancelamento deve ocorrer com no mínimo 24 horas de antecedência. Faltas sem aviso prévio serão cobradas integralmente.

6. CONFIDENCIALIDADE
O profissional compromete-se a manter o sigilo absoluto sobre todas as informações compartilhadas durante o processo terapêutico, conforme código de ética da categoria.

Data: ${new Date().toLocaleDateString('pt-BR')}
`
  },
  school_visit: {
    title: 'Contrato de Visita Escolar',
    description: 'Autorização e definição de acompanhamento pedagógico/clínico na escola.',
    icon: <School className="text-emerald-600" />,
    content: (p: Patient, c: any) => `TERMO DE AUTORIZAÇÃO PARA VISITA ESCOLAR

Eu, ${p.motherName || p.fatherName || p.name}, autorizo a equipe da ${c?.name || 'Clínica XCLIN'} a realizar visitas técnicas na instituição de ensino onde o paciente ${p.name} encontra-se matriculado.

FINALIDADE:
A visita tem como objetivo a observação do paciente em ambiente escolar, orientação aos docentes e coordenação pedagógica, visando o alinhamento das estratégias terapêuticas.

CONDIÇÕES:
1. O agendamento será feito em comum acordo com a escola.
2. O relatório da visita será compartilhado com os responsáveis legais.
3. Os custos da visita seguem a tabela vigente da clínica.

Assinatura do Responsável:
`
  },
  cancellation_policy: {
    title: 'Política de Faltas e Remarcações',
    description: 'Documento específico focado em regras de pontualidade e custos de ausência.',
    icon: <AlertTriangle className="text-amber-600" />,
    content: (p: Patient, c: any) => `POLÍTICA DE FALTAS E REMARCAÇÕES - ${c?.name || 'XCLIN'}

Prezado(a) ${p.name},

Para garantir a qualidade do atendimento e o respeito ao tempo dos profissionais e demais pacientes, estabelecemos as seguintes regras:

1. PRAZO DE AVISO: Cancelamentos ou remarcações devem ser comunicados com 24h de antecedência.
2. CUSTO DE FALTA: Faltas sem aviso prévio ou avisadas com menos de 24h serão cobradas integralmente como sessão realizada.
3. REPOSIÇÃO: A reposição estará sujeita à disponibilidade de agenda do profissional e não é obrigatória em caso de falta não justificada com antecedência.
4. ATRASOS: O tempo de atraso será descontado do tempo total da sessão.

Declaro estar ciente e de acordo com as normas acima.
`
  }
};

export default function Documents() {
  const { clinic } = useAuth();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [step, setStep] = useState(1); // 1: Type, 2: Patient, 3: Edit
  
  const [selectedType, setSelectedType] = useState<DocumentType | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchPatient, setSearchPatient] = useState('');
  const [documentContent, setDocumentContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [createdDocId, setCreatedDocId] = useState<string | null>(null);

  useEffect(() => {
    if (!clinic) return;

    const q = query(
      collection(db, 'documents'),
      where('clinicId', '==', clinic.id)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const allDocs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Document));
      
      // Sort in memory to avoid composite index error
      setDocuments(allDocs.sort((a, b) => {
        const dateA = a.createdAt?.toMillis() || 0;
        const dateB = b.createdAt?.toMillis() || 0;
        return dateB - dateA;
      }));
      setLoading(false);
    }, (err) => {
      // Avoid crashing the listener if it's just an index error during dev, 
      // but the user wants professional handling.
      handleFirestoreError(err, OperationType.GET, 'documents');
    });

    // Fetch patients for selection
    const fetchPatients = async () => {
      const pSnap = await getDocs(query(collection(db, 'patients'), where('clinicId', '==', clinic.id)));
      setPatients(pSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient)));
    };
    fetchPatients();

    return () => unsubscribe();
  }, [clinic]);

  const handleStartNew = () => {
    setStep(1);
    setSelectedType(null);
    setSelectedPatient(null);
    setDocumentContent('');
    setCreatedDocId(null);
    setIsModalOpen(true);
  };

  const handleSelectType = (type: DocumentType) => {
    setSelectedType(type);
    setStep(2);
  };

  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    const template = DOCUMENT_TEMPLATES[selectedType!];
    const initialContent = template.content(patient, clinic);
    setDocumentContent(initialContent);
    setStep(3);
  };

  const handleFinalize = async () => {
    if (!clinic || !selectedType || !selectedPatient) return;
    
    setIsGenerating(true);
    try {
      const docRef = await addDoc(collection(db, 'documents'), {
        clinicId: clinic.id,
        patientId: selectedPatient.id,
        patientName: selectedPatient.name,
        type: selectedType,
        title: DOCUMENT_TEMPLATES[selectedType].title,
        content: documentContent,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setCreatedDocId(docRef.id);
      setStep(4);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'documents');
    } finally {
      setIsGenerating(false);
    }
  };

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchPatient.toLowerCase())
  );

  const getStatusStyle = (status: DocumentStatus) => {
    switch (status) {
      case 'signed': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'sent': return 'bg-sky-50 text-sky-700 border-sky-100';
      case 'viewed': return 'bg-purple-50 text-purple-700 border-purple-100';
      case 'pending': return 'bg-slate-50 text-slate-700 border-slate-100';
      case 'refused': return 'bg-rose-50 text-rose-700 border-rose-100';
      default: return 'bg-slate-50 text-slate-700 border-slate-100';
    }
  };

  const getStatusIcon = (status: DocumentStatus) => {
    switch (status) {
      case 'signed': return <CheckCircle2 size={14} />;
      case 'sent': return <Send size={14} />;
      case 'viewed': return <ExternalLink size={14} />;
      case 'pending': return <Clock size={14} />;
      case 'refused': return <XCircle size={14} />;
      default: return null;
    }
  };

  const getSignatureUrl = (id: string) => `${window.location.origin}/sign/${id}`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Link copiado para a área de transferência!');
  };

  const handleViewDocument = (docId: string) => {
    window.open(`/sign/${docId}`, '_blank');
  };

  const handleSendMessage = (document: Document) => {
    const url = getSignatureUrl(document.id);
    const message = `Olá ${document.patientName}, seu documento (${document.title}) está disponível para assinatura no link abaixo:\n\n${url}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const [docToDelete, setDocToDelete] = useState<Document | null>(null);

  const handleDeleteDocument = async (docId: string) => {
    try {
      await deleteDoc(doc(db, 'documents', docId));
      setDocToDelete(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'documents');
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">Documentos & Contratos</h1>
          <p className="text-slate-500 mt-1">Gere e gerencie a formalização dos seus atendimentos.</p>
        </div>
        <button onClick={handleStartNew} className="btn-primary flex items-center gap-2 group">
          <Plus size={20} className="group-hover:rotate-90 transition-transform" />
          Novo Documento
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
              <Search size={18} className="text-slate-400" />
              <input type="text" placeholder="Buscar por paciente ou título..." className="bg-transparent border-none focus:ring-0 w-full text-sm" />
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left bg-slate-50/50">
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Documento</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Paciente</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Data</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400">Carregando documentos...</td></tr>
                  ) : documents.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400">Nenhum documento gerado ainda.</td></tr>
                  ) : (
                    documents.map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${getStatusStyle(doc.status)} bg-opacity-10`}>
                              <FileText size={18} />
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900 text-sm">{doc.title}</p>
                              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">ID: {doc.id.slice(0, 8)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-slate-700">{doc.patientName}</p>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500">
                          {doc.createdAt?.toDate().toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold border flex items-center gap-1.5 w-fit ${getStatusStyle(doc.status)}`}>
                            {getStatusIcon(doc.status)}
                            {doc.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleViewDocument(doc.id)}
                              className="p-2 hover:bg-white hover:shadow-md rounded-lg text-slate-400 hover:text-sky-600 transition-all border border-transparent hover:border-slate-100"
                              title="Visualizar"
                            >
                              <ExternalLink size={16} />
                            </button>
                            <button 
                              onClick={() => handleSendMessage(doc)}
                              className="p-2 hover:bg-white hover:shadow-md rounded-lg text-slate-400 hover:text-emerald-600 transition-all border border-transparent hover:border-slate-100"
                              title="Enviar Mensagem"
                            >
                              <MessageSquare size={16} />
                            </button>
                            <button 
                              onClick={() => setDocToDelete(doc)}
                              className="p-2 hover:bg-white hover:shadow-md rounded-lg text-slate-400 hover:text-rose-600 transition-all border border-transparent hover:border-slate-100"
                              title="Excluir"
                            >
                              <Trash2 size={16} />
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
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-sky-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg shadow-sky-100">
            <h3 className="font-bold flex items-center gap-2 mb-2">
              <CheckCircle2 size={18} />
              Segurança Jurídica
            </h3>
            <p className="text-sky-100 text-sm leading-relaxed">
              Todos os documentos gerados utilizam modelos validados e rastreiam a assinatura por IP e data, garantindo profissionalismo absoluto para sua clínica.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-4">Modelos Disponíveis</h3>
            <div className="space-y-4">
              {Object.entries(DOCUMENT_TEMPLATES).map(([key, template]) => (
                <div key={key} className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all cursor-pointer">
                  <div className="mt-1">{template.icon}</div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{template.title}</p>
                    <p className="text-xs text-slate-500 leading-tight mt-0.5">{template.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* New Document Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-4">
                  {step > 1 && (
                    <button onClick={() => setStep(step - 1)} className="p-2 hover:bg-white rounded-xl text-slate-500 transition-colors shadow-sm border border-slate-200">
                      <ArrowLeft size={18} />
                    </button>
                  )}
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">
                      {step === 1 ? 'Tipo de Documento' : 
                       step === 2 ? 'Selecionar Paciente' : 
                       step === 3 ? 'Personalizar Conteúdo' : 'Documento Criado!'}
                    </h3>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Passo {step} de 4</p>
                  </div>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 bg-slate-50/30">
                {step === 1 && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {(Object.keys(DOCUMENT_TEMPLATES) as DocumentType[]).map(key => (
                      <div 
                        key={key} 
                        onClick={() => handleSelectType(key)}
                        className="bg-white p-6 rounded-2xl border-2 border-slate-100 hover:border-sky-500 hover:shadow-xl hover:shadow-sky-50 transition-all cursor-pointer group flex flex-col h-full"
                      >
                        <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center group-hover:scale-110 transition-transform mb-4">
                          {DOCUMENT_TEMPLATES[key].icon}
                        </div>
                        <h4 className="font-bold text-slate-900 mb-2">{DOCUMENT_TEMPLATES[key].title}</h4>
                        <p className="text-xs text-slate-500 flex-1">{DOCUMENT_TEMPLATES[key].description}</p>
                        <div className="mt-4 flex items-center gap-2 text-sky-600 font-bold text-[10px] uppercase tracking-wider">
                          Selecionar <ChevronRight size={14} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-6">
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
                      <Search size={20} className="text-slate-400" />
                      <input 
                        type="text" 
                        placeholder="Buscar paciente pelo nome..." 
                        className="bg-transparent border-none focus:ring-0 w-full"
                        value={searchPatient}
                        onChange={e => setSearchPatient(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredPatients.map(p => (
                        <div 
                          key={p.id}
                          onClick={() => handleSelectPatient(p)}
                          className="bg-white p-4 rounded-xl border border-slate-100 hover:border-emerald-500 transition-all cursor-pointer flex items-center gap-4 group"
                        >
                          <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center font-bold text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                            {p.name[0]}
                          </div>
                          <div className="flex-1">
                            <p className="font-bold text-slate-900 text-sm">{p.name}</p>
                            <p className="text-xs text-slate-400">{p.email || p.phone || 'Sem contato'}</p>
                          </div>
                          <ChevronRight size={16} className="text-slate-300 group-hover:text-emerald-500 transition-colors" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-6">
                    <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl text-amber-800 text-sm flex gap-3">
                      <AlertTriangle className="shrink-0" size={20} />
                      <p>Revise e personalize as cláusulas abaixo. Os campos entre colchetes [ ] devem ser preenchidos manualmente conforme as condições da sua sessão.</p>
                    </div>
                    <textarea 
                      className="w-full min-h-[400px] bg-white border border-slate-200 rounded-2xl p-6 font-serif leading-relaxed text-slate-800 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 shadow-inner"
                      value={documentContent}
                      onChange={e => setDocumentContent(e.target.value)}
                    />
                  </div>
                )}

                {step === 4 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center space-y-6">
                    <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center animate-bounce">
                      <CheckCircle2 size={40} />
                    </div>
                    <div>
                      <h4 className="text-2xl font-bold text-slate-900">Documento Pronto!</h4>
                      <p className="text-slate-500">O contrato foi gerado com sucesso para {selectedPatient?.name}.</p>
                    </div>
                    
                    <div className="bg-slate-50 border border-slate-100 p-6 rounded-2xl w-full max-w-md space-y-4 shadow-sm">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Compartilhar para Assinatura</p>
                      
                      <div className="flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-200">
                        <input 
                          readOnly 
                          value={getSignatureUrl(createdDocId!)} 
                          className="flex-1 bg-transparent border-none text-xs text-slate-500 focus:ring-0 truncate" 
                        />
                        <button 
                          onClick={() => copyToClipboard(getSignatureUrl(createdDocId!))}
                          className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-sky-600 transition-colors"
                        >
                          <Copy size={16} />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <button className="btn-secondary flex items-center justify-center gap-2 text-emerald-600 border-emerald-100">
                          <MessageSquare size={16} /> WhatsApp
                        </button>
                        <button className="btn-secondary flex items-center justify-center gap-2 text-sky-600 border-sky-100">
                          <Mail size={16} /> E-mail
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <button onClick={() => navigate(`/sign/${createdDocId}`)} className="btn-secondary flex items-center gap-2">
                        <Printer size={18} /> Visualizar PDF
                      </button>
                      <button onClick={() => setIsModalOpen(false)} className="btn-primary">
                        Ir para Documentos
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {step < 4 && (
                <div className="p-6 border-t border-slate-100 bg-white flex justify-end gap-4">
                  <button onClick={() => setIsModalOpen(false)} className="btn-secondary px-8">Cancelar</button>
                  {step === 3 && (
                    <button onClick={handleFinalize} disabled={isGenerating} className="btn-primary px-8 flex items-center gap-2">
                      {isGenerating ? 'Processando...' : 'Finalizar e Gerar Link'}
                      {!isGenerating && <Send size={18} />}
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      {docToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 text-center mb-2">Deseja realmente excluir?</h3>
            <p className="text-sm text-slate-500 text-center mb-6 leading-relaxed">
              Esta ação removerá permanentemente o documento <span className="font-bold text-slate-700">{docToDelete.title}</span> e o link de assinatura não funcionará mais.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDocToDelete(null)} className="flex-1 btn-secondary text-sm">Cancelar</button>
              <button 
                onClick={() => handleDeleteDocument(docToDelete.id)} 
                className="flex-1 py-2 rounded-xl bg-rose-600 text-white font-bold text-sm hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/20"
              >
                Excluir Documento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
