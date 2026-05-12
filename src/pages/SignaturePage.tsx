import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Document, DocumentStatus } from '../types';
import { 
  FileCheck, 
  CheckCircle2, 
  XCircle, 
  Download, 
  ShieldCheck, 
  Info,
  Calendar,
  User,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function SignaturePage() {
  const { id } = useParams<{ id: string }>();
  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSigning, setIsSigning] = useState(false);
  const [isSigned, setIsSigned] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signatureName, setSignatureName] = useState('');
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    const fetchDoc = async () => {
      if (!id) return;
      try {
        const dSnap = await getDoc(doc(db, 'documents', id));
        if (dSnap.exists()) {
          const data = { id: dSnap.id, ...dSnap.data() } as Document;
          setDocument(data);
          if (data.status === 'signed') setIsSigned(true);
          
          // Update status to 'viewed' if it was 'sent'
          if (data.status === 'sent' || data.status === 'pending') {
            await updateDoc(doc(db, 'documents', id), {
              status: 'viewed' as DocumentStatus,
              viewedAt: serverTimestamp()
            });
          }
        } else {
          setError('Documento não encontrado ou link expirado.');
        }
      } catch (err) {
        setError('Ocorreu um erro ao carregar o documento.');
      } finally {
        setLoading(false);
      }
    };
    fetchDoc();
  }, [id]);

  const handleSign = async () => {
    if (!id || !signatureName || !agreed) return;
    
    setIsSigning(true);
    try {
      // Get visitor IP (simulation for local, would use service in production)
      const ipResponse = await fetch('https://api.ipify.org?format=json').catch(() => ({ json: () => ({ ip: 'Indisponível' }) }));
      const ipData = await (ipResponse as any).json();

      await updateDoc(doc(db, 'documents', id), {
        status: 'signed' as DocumentStatus,
        signedAt: serverTimestamp(),
        signedBy: signatureName,
        signatureIp: ipData.ip || 'Local',
        updatedAt: serverTimestamp()
      });
      setIsSigned(true);
      setIsSigning(false);
    } catch (err) {
      console.error(err);
      alert('Erro ao processar assinatura. Tente novamente.');
      setIsSigning(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 font-medium animate-pulse">Carregando ambiente seguro...</p>
        </div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-12 rounded-3xl shadow-xl max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto">
            <XCircle size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Oops! Algo deu errado.</h2>
          <p className="text-slate-500">{error || 'Código de acesso inválido.'}</p>
          <button onClick={() => window.location.reload()} className="w-full btn-primary">Tentar Novamente</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 selection:bg-sky-100">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 print:hidden">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-sky-100 text-sky-700 text-[10px] font-bold rounded-full uppercase tracking-widest border border-sky-200">Ambiente Seguro</span>
              <ShieldCheck className="text-emerald-500" size={16} />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{document.title}</h1>
            <div className="flex flex-wrap gap-4 text-sm text-slate-500">
              <span className="flex items-center gap-1.5"><Calendar size={14} /> Emitido em: {new Date().toLocaleDateString('pt-BR')}</span>
              <span className="flex items-center gap-1.5"><User size={14} /> Paciente: {document.patientName}</span>
            </div>
          </div>
          <button onClick={handlePrint} className="btn-secondary flex items-center justify-center gap-2 shadow-sm">
            <Download size={18} /> Baixar PDF
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Document Content */}
          <div className="lg:col-span-2 space-y-6 print:w-full">
            <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl p-8 md:p-12 min-h-screen flex flex-col print:shadow-none print:border-none print:p-0">
              <div className="flex justify-between items-start mb-12 border-b border-slate-100 pb-8">
                <div className="space-y-1">
                  <div className="text-2xl font-black text-slate-950 flex items-center gap-2">
                    <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center text-xl">X</div>
                    XCLIN
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">{document.clinicId.slice(0, 8)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-400 uppercase mb-1">Status do Documento</p>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest border ${isSigned ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                    {isSigned ? 'DOCUMENTO ASSINADO' : 'AGUARDANDO ASSINATURA'}
                  </span>
                </div>
              </div>

              <div className="flex-1 font-serif text-slate-800 leading-relaxed text-lg whitespace-pre-wrap">
                {document.content}
              </div>

              {isSigned && (
                <div className="mt-12 pt-8 border-t border-slate-100 space-y-6 animate-in fade-in duration-1000">
                  <div className="flex items-center gap-3 text-emerald-600">
                    <CheckCircle2 size={24} />
                    <span className="font-bold">Assinado Digitalmente por {document.signedBy}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-[10px] text-slate-400 font-bold uppercase tracking-widest bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div>Data/Hora: {document.signedAt?.toDate().toLocaleString('pt-BR')}</div>
                    <div>IP de Origem: {document.signatureIp}</div>
                    <div>Autenticação: {document.id}</div>
                    <div className="text-emerald-500">Documento Válido</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Signature Box */}
          {!isSigned && (
            <div className="print:hidden">
              <motion.div 
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                className="sticky top-8 bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden"
              >
                <div className="bg-sky-600 p-6 text-white text-center">
                  <FileCheck size={32} className="mx-auto mb-3" />
                  <h3 className="text-xl font-bold">Assinatura Digital</h3>
                  <p className="text-sky-100 text-xs mt-1">Conclua a formalização abaixo</p>
                </div>
                <div className="p-8 space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2 tracking-widest">Nome Completo</label>
                    <input 
                      type="text" 
                      placeholder="Igual ao documento de identidade" 
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all outline-none"
                      value={signatureName}
                      onChange={e => setSignatureName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-4">
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <div className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${agreed ? 'bg-sky-600 border-sky-600' : 'bg-slate-50 border-slate-200 group-hover:border-slate-300'}`}>
                        {agreed && <CheckCircle2 size={12} className="text-white" />}
                        <input type="checkbox" className="hidden" checked={agreed} onChange={() => setAgreed(!agreed)} />
                      </div>
                      <span className="text-xs text-slate-500 leading-normal">
                        Li e aceito os termos do contrato, bem como concordo com a autenticação via assinatura digital e registro de IP conforme Lei nº 14.063/2020.
                      </span>
                    </label>
                  </div>

                  <button 
                    disabled={!agreed || !signatureName || isSigning}
                    onClick={handleSign}
                    className="w-full btn-primary py-4 rounded-2xl shadow-lg shadow-sky-100 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none transition-all flex items-center justify-center gap-2"
                  >
                    {isSigning ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>Assinar Documento <Activity size={18} /></>
                    )}
                  </button>

                  <div className="pt-4 flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                    <Info size={14} className="text-slate-300" />
                    Esta operação é registrada e possui validade jurídica em todo território nacional.
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {isSigned && (
            <div className="print:hidden">
              <motion.div 
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                className="sticky top-8 bg-emerald-50 border border-emerald-100 rounded-3xl p-8 text-center space-y-6"
              >
                <div className="w-16 h-16 bg-white text-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle2 size={32} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-emerald-900">Sucesso!</h3>
                  <p className="text-emerald-700 text-sm mt-1 leading-relaxed">Este contrato foi devidamente assinado. Você pode fechar esta aba ou salvar o comprovante.</p>
                </div>
                <button onClick={handlePrint} className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors">
                  <Download size={18} /> Salvar Comprovante
                </button>
              </motion.div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
