import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc,
  updateDoc,
  serverTimestamp, 
  orderBy,
  deleteDoc,
  doc,
  Timestamp
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Trash2, 
  Filter,
  ArrowUpCircle,
  ArrowDownCircle,
  Printer,
  RefreshCw,
  Calendar,
  AlertCircle,
  BarChart3,
  ChevronRight,
  Pencil
} from 'lucide-react';
import { FinancialTransaction, Patient } from '../types';
import { motion, AnimatePresence } from 'motion/react';

export function Financial() {
  const { clinic } = useAuth();
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [newTrans, setNewTrans] = useState({
    type: 'income' as 'income' | 'expense',
    category: '',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    status: 'paid' as 'paid' | 'pending',
    patientId: '',
    patientName: '',
    isRecurring: false,
    frequency: 'monthly' as 'daily' | 'weekly' | 'monthly',
    expenseType: 'fixed' as 'fixed' | 'variable',
    repetitions: ''
  });

  const [editingTransId, setEditingTransId] = useState<string | null>(null);
  const [editSeriesMode, setEditSeriesMode] = useState<'none' | 'ask' | 'single' | 'following' | 'all'>('none');
  const [seriesAction, setSeriesAction] = useState<'delete' | 'edit' | null>(null);
  const [targetTrans, setTargetTrans] = useState<FinancialTransaction | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState<string | null>(null);

  const generateRecurringTransactions = (baseTransaction: any, count: number) => {
    const transactions = [];
    const startDate = baseTransaction.date.toDate ? baseTransaction.date.toDate() : new Date(baseTransaction.date);
    const dayOfMonth = startDate.getDate();
    
    let currentDate = new Date(startDate);
    
    for (let i = 1; i < count; i++) {
      const nextDate = new Date(currentDate);
      
      if (baseTransaction.frequency === 'daily') {
        nextDate.setDate(nextDate.getDate() + 1);
      } else if (baseTransaction.frequency === 'weekly') {
        nextDate.setDate(nextDate.getDate() + 7);
      } else if (baseTransaction.frequency === 'monthly') {
        // Precise monthly logic: same day of month
        nextDate.setMonth(nextDate.getMonth() + 1);
        // Handle month overflow (e.g., Jan 31 -> Feb 28/29)
        if (nextDate.getDate() !== dayOfMonth) {
          nextDate.setDate(0); // Set to last day of previous month
        }
      }
      
      const { id, ...payloadWithoutId } = baseTransaction;
      
      transactions.push({
        ...payloadWithoutId,
        date: Timestamp.fromDate(nextDate),
        status: 'pending',
        createdAt: serverTimestamp()
      });
      currentDate = nextDate;
    }
    return transactions;
  };

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const fetchData = async () => {
    if (!clinic) return;
    try {
      const q = query(
        collection(db, 'financialTransactions'),
        where('clinicId', '==', clinic.id)
      );
      const snap = await getDocs(q);
      const allTrans = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as FinancialTransaction));
      
      // Sort in memory to avoid index error
      setTransactions(allTrans.sort((a, b) => {
        const dateA = (a.date as any).seconds || new Date(a.date).getTime();
        const dateB = (b.date as any).seconds || new Date(b.date).getTime();
        return dateB - dateA;
      }));

      // Fetch patients for selection
      const pSnap = await getDocs(query(collection(db, 'patients'), where('clinicId', '==', clinic.id)));
      setPatients(pSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient)).sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'financialTransactions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [clinic]);

  const handleAddTransaction = async (e?: React.FormEvent, modeOverride?: any) => {
    if (e) e.preventDefault();
    if (!clinic) return;

    const currentMode = modeOverride || editSeriesMode;

    try {
      const transactionDate = new Date(newTrans.date + 'T12:00:00');
      
      if (editingTransId) {
        const transaction = transactions.find(t => t.id === editingTransId);
        if (transaction?.recurrenceId && currentMode === 'none') {
          setTargetTrans(transaction);
          setSeriesAction('edit');
          return;
        }

        const updateData: any = {
          type: newTrans.type,
          category: newTrans.category,
          amount: Number(newTrans.amount),
          description: newTrans.description,
          date: Timestamp.fromDate(transactionDate),
          status: newTrans.status,
          patientId: newTrans.patientId || null,
          patientName: newTrans.patientName || null,
          expenseType: newTrans.type === 'expense' ? (newTrans.expenseType || 'fixed') : null,
          updatedAt: serverTimestamp()
        };

        if (currentMode === 'single' || !transaction?.recurrenceId) {
          await updateDoc(doc(db, 'financialTransactions', editingTransId), updateData);
        } else if (currentMode === 'following') {
          const q = query(
            collection(db, 'financialTransactions'),
            where('recurrenceId', '==', transaction.recurrenceId),
            where('date', '>=', transaction.date)
          );
          const snap = await getDocs(q);
          const batchPromises = snap.docs.map(d => updateDoc(doc(db, 'financialTransactions', d.id), updateData));
          await Promise.all(batchPromises);
        } else if (currentMode === 'all') {
          const q = query(collection(db, 'financialTransactions'), where('recurrenceId', '==', transaction.recurrenceId));
          const snap = await getDocs(q);
          const batchPromises = snap.docs.map(d => updateDoc(doc(db, 'financialTransactions', d.id), updateData));
          await Promise.all(batchPromises);
        }
      } else {
        const recurrenceId = newTrans.isRecurring ? Math.random().toString(36).substring(7) : null;
        
        // Sanitized payload to avoid any 'undefined' values
        const payload: any = {
          type: newTrans.type || 'income',
          category: newTrans.category || 'Geral',
          amount: Number(newTrans.amount) || 0,
          description: newTrans.description || '',
          date: Timestamp.fromDate(transactionDate),
          status: newTrans.status || 'pending',
          patientId: newTrans.patientId || null,
          patientName: newTrans.patientName || null,
          clinicId: clinic.id,
          isRecurring: !!newTrans.isRecurring,
          recurrenceId: recurrenceId,
          frequency: newTrans.isRecurring ? (newTrans.frequency || 'monthly') : null,
          expenseType: newTrans.type === 'expense' ? (newTrans.expenseType || 'fixed') : null,
          repetitions: newTrans.isRecurring ? (Number(newTrans.repetitions) || 12) : null,
          createdAt: serverTimestamp()
        };

        if (!newTrans.isRecurring) {
          await addDoc(collection(db, 'financialTransactions'), payload);
        } else {
          const count = Number(newTrans.repetitions) || 12;
          const recurringItems = generateRecurringTransactions(payload, count);
          
          // Save first instance
          await addDoc(collection(db, 'financialTransactions'), payload);
          
          // Save recurring series
          const batchPromises = recurringItems.map(item => 
            addDoc(collection(db, 'financialTransactions'), item)
          );
          await Promise.all(batchPromises);
        }
      }

      setIsModalOpen(false);
      setEditingTransId(null);
      setEditSeriesMode('none');
      setShowSuccessToast(editingTransId ? 'Lançamento atualizado com sucesso!' : 'Lançamento criado com sucesso!');
      setTimeout(() => setShowSuccessToast(null), 3000);
      setNewTrans({
        type: 'income',
        category: '',
        amount: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
        status: 'paid',
        patientId: '',
        patientName: '',
        isRecurring: false,
        frequency: 'monthly',
        expenseType: 'fixed',
        repetitions: ''
      });
      fetchData();
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, 'financialTransactions');
    }
  };

  const handleEdit = (t: FinancialTransaction) => {
    const tDate = (t.date as any).toDate ? (t.date as any).toDate().toISOString().split('T')[0] : new Date(t.date).toISOString().split('T')[0];
    setEditingTransId(t.id);
    setNewTrans({
      type: t.type,
      category: t.category,
      amount: t.amount.toString(),
      description: t.description,
      date: tDate,
      status: t.status as any,
      patientId: t.patientId || '',
      patientName: t.patientName || '',
      isRecurring: !!t.isRecurring,
      frequency: t.frequency || 'monthly',
      expenseType: t.expenseType || 'fixed',
      repetitions: t.repetitions?.toString() || ''
    });
    setEditSeriesMode('none');
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'paid' ? 'pending' : 'paid';
    try {
      await updateDoc(doc(db, 'financialTransactions', id), { 
        status: newStatus,
        updatedAt: serverTimestamp() 
      });
      fetchData();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `financialTransactions/${id}`);
    }
  };

  const handleDelete = async (id: string, modeOverride?: any) => {
    const transaction = transactions.find(t => t.id === id);
    const currentMode = modeOverride || editSeriesMode;

    if (transaction?.recurrenceId && currentMode === 'none') {
      setTargetTrans(transaction);
      setSeriesAction('delete');
      return;
    }

    try {
      if (currentMode === 'single' || !transaction?.recurrenceId) {
        await deleteDoc(doc(db, 'financialTransactions', id));
      } else if (currentMode === 'following') {
        const q = query(
          collection(db, 'financialTransactions'),
          where('recurrenceId', '==', transaction.recurrenceId),
          where('date', '>=', transaction.date)
        );
        const snap = await getDocs(q);
        const batchPromises = snap.docs.map(d => deleteDoc(doc(db, 'financialTransactions', d.id)));
        await Promise.all(batchPromises);
      } else if (currentMode === 'all') {
        const q = query(
          collection(db, 'financialTransactions'),
          where('recurrenceId', '==', transaction.recurrenceId)
        );
        const snap = await getDocs(q);
        const batchPromises = snap.docs.map(d => deleteDoc(doc(db, 'financialTransactions', d.id)));
        await Promise.all(batchPromises);
      }

      setDeleteConfirmId(null);
      setEditSeriesMode('none');
      setTargetTrans(null);
      setSeriesAction(null);
      fetchData();
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, `financialTransactions/${id}`);
    }
  };

  const handlePrintReceipt = (t: FinancialTransaction) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const tDate = (t.date as any).toDate ? (t.date as any).toDate() : new Date(t.date);
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Recibo - ${clinic?.name}</title>
          <style>
            body { font-family: 'Inter', sans-serif; padding: 40px; color: #334155; line-height: 1.6; background: #f8fafc; }
            .receipt-container { 
              background: white;
              border: 1px solid #e2e8f0; 
              padding: 60px; 
              border-radius: 24px; 
              max-width: 800px; 
              margin: 40px auto; 
              box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1); 
              position: relative; 
              overflow: hidden; 
            }
            .brand-line { 
              position: absolute; 
              top: 0; 
              left: 0; 
              width: 100%; 
              height: 12px; 
              background: linear-gradient(90deg, #0284c7, #38bdf8); 
            }
            .header { 
              display: flex; 
              justify-content: space-between; 
              align-items: start; 
              border-bottom: 2px solid #f1f5f9; 
              margin-bottom: 50px; 
              padding-bottom: 30px; 
            }
            .clinic-info h1 { margin: 0; color: #0f172a; font-size: 2em; font-weight: 900; letter-spacing: -0.025em; }
            .clinic-info p { margin: 8px 0; color: #64748b; font-size: 1em; font-weight: 500; }
            .receipt-details { text-align: right; }
            .receipt-details h2 { margin: 0; color: #0284c7; letter-spacing: 4px; font-weight: 900; font-size: 1.2em; }
            .receipt-number { margin: 8px 0; color: #94a3b8; font-weight: bold; font-size: 0.9em; }
            .receipt-status { 
              display: inline-block;
              padding: 4px 12px;
              background: #f0fdf4;
              color: #166534;
              border-radius: 9999px;
              font-size: 0.75em;
              font-weight: 800;
              text-transform: uppercase;
              margin-top: 10px;
            }
            
            .content { margin-bottom: 50px; }
            .amount-card { 
              background: #f0f9ff; 
              border: 2px solid #bae6fd; 
              padding: 30px; 
              border-radius: 20px; 
              margin-bottom: 40px; 
              text-align: center;
            }
            .amount-label { color: #0369a1; font-weight: 800; text-transform: uppercase; font-size: 0.85em; letter-spacing: 0.05em; margin-bottom: 10px; display: block;}
            .amount-value { color: #0c4a6e; font-size: 3em; font-weight: 900; }
            
            .description-box { 
              font-size: 1.2em; 
              color: #475569; 
              line-height: 1.8;
              text-align: justify;
            }
            .highlight { font-weight: 800; color: #0f172a; text-decoration: underline decoration-sky-500/30 underline-offset-4; }
            
            .info-grid { 
              display: grid; 
              grid-template-cols: 1fr 1fr; 
              gap: 20px; 
              margin-top: 40px;
              padding: 20px;
              background: #f8fafc;
              border-radius: 16px;
            }
            .info-item { display: flex; flex-direction: column; gap: 4px; }
            .info-label { font-size: 0.7em; font-weight: 800; color: #94a3b8; text-transform: uppercase; }
            .info-value { font-size: 0.9em; font-weight: 600; color: #334155; }

            .footer { margin-top: 80px; display: flex; flex-direction: column; align-items: center; gap: 60px; }
            .signature-area { 
              border-top: 2px solid #e2e8f0; 
              width: 100%;
              max-width: 400px; 
              text-align: center; 
              padding-top: 15px; 
            }
            .signature-name { margin: 0; font-weight: 900; color: #0f172a; font-size: 1.1em; }
            .signature-label { font-size: 0.8em; font-weight: 600; color: #64748b; margin-top: 4px; display: block; }
            
            .watermark {
              position: absolute;
              bottom: -50px;
              right: -50px;
              font-size: 15em;
              font-weight: 900;
              color: #f1f5f9;
              z-index: -1;
              opacity: 0.5;
              pointer-events: none;
            }

            @media print {
              body { background: white; padding: 0; }
              .receipt-container { 
                border: none; 
                box-shadow: none; 
                padding: 40px; 
                margin: 0;
                max-width: 100%;
              }
            }
          </style>
        </head>
        <body>
          <div class="receipt-container">
            <div class="brand-line"></div>
            <div class="watermark">${t.type === 'income' ? 'CRED' : 'DEBT'}</div>
            
            <div class="header">
              <div class="clinic-info">
                <h1>${clinic?.name || 'XCLIN'}</h1>
                <p>Centro Clínico Especializado</p>
                <p>Sistema XCLIN - Saúde e Tecnologia</p>
              </div>
              <div class="receipt-details">
                <h2>RECIBO</h2>
                <div class="receipt-number">ID: #${t.id.slice(-6).toUpperCase()}</div>
                <div class="receipt-status">${t.status === 'paid' ? (t.type === 'income' ? 'RECEBIDO' : 'PAGO') : 'PENDENTE'}</div>
              </div>
            </div>
            
            <div class="content">
              <div class="amount-card">
                <span class="amount-label">Valor do Lançamento</span>
                <span class="amount-value">R$ ${t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              
              <div class="description-box">
                Confirmamos que foi ${t.type === 'income' ? 'recebido de' : 'pago a'} <span class="highlight">${t.patientName || (t.type === 'income' ? '____________________' : 'Fornecedor')}</span>,
                a importância de <span class="highlight">R$ ${t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>,
                referente a <span class="highlight">${t.description || t.category}</span>.
              </div>

              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">Categoria</span>
                  <span class="info-value">${t.category}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Data de Emissão</span>
                  <span class="info-value">${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(tDate)}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Tipo de Lançamento</span>
                  <span class="info-value">${t.type === 'income' ? 'Receita' : 'Despesa'} ${t.isRecurring ? '(Recorrente)' : ''}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Status Financeiro</span>
                  <span class="info-value">${t.status === 'paid' ? 'Liquidado' : 'Aguardando Pagamento'}</span>
                </div>
              </div>
            </div>
            
            <div class="footer">
              <div class="signature-area">
                <p class="signature-name">${clinic?.name || 'Responsável Clínico'}</p>
                <span class="signature-label">Carimbo e Assinatura</span>
              </div>
              
              <p style="font-size: 0.7em; color: #94a3b8; font-weight: 500;">
                Documento gerado eletronicamente em ${new Date().toLocaleString('pt-BR')} pelo sistema XCLIN.
              </p>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  const filteredTransactions = transactions.filter(t => {
    const matchesCategory = filterCategory === '' || t.category.toLowerCase().includes(filterCategory.toLowerCase());
    const tDate = (t.date as any).toDate ? (t.date as any).toDate() : new Date(t.date);
    const matchesStartDate = filterStartDate === '' || tDate >= new Date(filterStartDate);
    const matchesEndDate = filterEndDate === '' || tDate <= new Date(filterEndDate + 'T23:59:59');
    return matchesCategory && matchesStartDate && matchesEndDate;
  });

  const totalIncome = filteredTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const totalExpense = filteredTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
  const balance = totalIncome - totalExpense;

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const recurringIncomeMonth = filteredTransactions.filter(t => {
    const tDate = (t.date as any).toDate ? (t.date as any).toDate() : new Date(t.date);
    return t.type === 'income' && t.isRecurring && tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear;
  }).reduce((acc, t) => acc + t.amount, 0);

  const fixedExpensesMonth = filteredTransactions.filter(t => {
    const tDate = (t.date as any).toDate ? (t.date as any).toDate() : new Date(t.date);
    return t.type === 'expense' && t.expenseType === 'fixed' && tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear;
  }).reduce((acc, t) => acc + t.amount, 0);

  const overduePayments = filteredTransactions.filter(t => {
    const tDate = (t.date as any).toDate ? (t.date as any).toDate() : new Date(t.date);
    return t.status === 'pending' && tDate < now;
  }).length;

  const upcomingPayments = filteredTransactions.filter(t => {
    const tDate = (t.date as any).toDate ? (t.date as any).toDate() : new Date(t.date);
    const inNext7Days = tDate > now && tDate <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return t.status === 'pending' && inNext7Days;
  }).length;

  return (
    <div className="space-y-6">
      {/* Success Toast */}
      <AnimatePresence>
        {showSuccessToast && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] bg-emerald-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 font-bold"
          >
            <div className="w-6 h-6 bg-white/20 rounded-lg flex items-center justify-center text-white">
              <Plus size={14} />
            </div>
            {showSuccessToast}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-sky-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-sky-600/20">
            <DollarSign size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 font-sans">Financeiro</h1>
            <p className="text-slate-500 text-sm">Controle o fluxo de caixa e recorrências da clínica.</p>
          </div>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="btn-primary"
        >
          <Plus size={18} />
          Novo Lançamento
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="medical-card p-6 bg-white border-b-4 border-b-emerald-500 overflow-hidden relative group hover:shadow-xl transition-all">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Saldo Geral</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-110 transition-transform"><TrendingUp size={20} /></div>
          </div>
          <h3 className={`text-2xl font-black ${balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </h3>
          <p className="text-[10px] text-slate-400 mt-1 font-medium">Balanço total do período</p>
        </div>

        <div className="medical-card p-6 bg-white border-b-4 border-b-sky-500 overflow-hidden relative group hover:shadow-xl transition-all">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Recorrência (Mês)</span>
            <div className="p-2 bg-sky-50 text-sky-600 rounded-xl group-hover:scale-110 transition-transform"><RefreshCw size={20} /></div>
          </div>
          <h3 className="text-2xl font-black text-slate-900">
            R$ {recurringIncomeMonth.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </h3>
          <p className="text-[10px] text-emerald-600 mt-1 font-bold">Receitas recorrentes previstas</p>
        </div>

        <div className="medical-card p-6 bg-white border-b-4 border-b-red-500 overflow-hidden relative group hover:shadow-xl transition-all">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Custos Fixos</span>
            <div className="p-2 bg-red-50 text-red-600 rounded-xl group-hover:scale-110 transition-transform"><TrendingDown size={20} /></div>
          </div>
          <h3 className="text-2xl font-black text-slate-900">
            R$ {fixedExpensesMonth.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </h3>
          <p className="text-[10px] text-red-600 mt-1 font-bold">Total de despesas fixas</p>
        </div>

        <div className="medical-card p-6 bg-white border-b-4 border-b-amber-500 overflow-hidden relative group hover:shadow-xl transition-all">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pendências</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl group-hover:scale-110 transition-transform"><AlertCircle size={20} /></div>
          </div>
          <div className="flex items-end gap-2">
            <h3 className="text-2xl font-black text-amber-600">{overduePayments}</h3>
            <span className="text-xs font-bold text-slate-400 mb-1.5 uppercase">Atrasados</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1 font-medium">{upcomingPayments} próximos vencimentos</p>
        </div>
      </div>

      <div className="medical-card">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800">Lançamentos</h3>
            <div className="flex items-center gap-2">
              <input 
                type="text" placeholder="Categoria..." 
                className="text-xs border border-slate-200 rounded-lg py-1.5 px-3 focus:ring-1 focus:ring-sky-500"
                value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
              />
              <div className="flex items-center gap-1">
                <input 
                  type="date"
                  className="text-xs border border-slate-200 rounded-lg py-1.5 px-2 focus:ring-1 focus:ring-sky-500"
                  value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)}
                />
                <span className="text-slate-400">à</span>
                <input 
                  type="date"
                  className="text-xs border border-slate-200 rounded-lg py-1.5 px-2 focus:ring-1 focus:ring-sky-500"
                  value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-100">
                <th className="px-6 py-4">Data</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Descrição / Paciente</th>
                <th className="px-6 py-4">Categoria</th>
                <th className="px-6 py-4 text-right">Valor</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="p-12 text-center text-slate-400">Carregando...</td></tr>
              ) : filteredTransactions.length === 0 ? (
                <tr><td colSpan={6} className="p-12 text-center text-slate-400">Nenhum lançamento encontrado.</td></tr>
              ) : (
                filteredTransactions.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {(t.date as any).toDate ? (t.date as any).toDate().toLocaleDateString('pt-BR') : new Date(t.date).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => handleToggleStatus(t.id, t.status || 'paid')}
                        className={`
                          px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all
                          ${(t.status === 'paid' || !t.status) ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700 shadow-sm'}
                        `}
                      >
                        <div className={`w-1.5 h-1.5 rounded-full ${(t.status === 'paid' || !t.status) ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                        {(t.status === 'paid' || !t.status) ? (t.type === 'income' ? 'Recebido' : 'Pago') : 'Pendente'}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {t.type === 'income' ? <ArrowUpCircle className="text-emerald-500" size={18} /> : <ArrowDownCircle className="text-red-500" size={18} />}
                        <div>
                          <p className="font-medium text-slate-800 flex items-center gap-2">
                            {t.description}
                            {t.isRecurring && (
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase flex items-center gap-1 ${t.type === 'income' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                <RefreshCw size={8} /> Recorrente
                              </span>
                            )}
                          </p>
                          {t.patientName && <p className="text-[10px] text-sky-600 font-bold uppercase tracking-tight">{t.patientName}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider w-fit">
                          {t.category}
                        </span>
                        {t.expenseType && (
                          <span className={`text-[9px] font-bold uppercase ${t.expenseType === 'fixed' ? 'text-red-600' : 'text-amber-600'}`}>
                            {t.expenseType === 'fixed' ? 'Fixa' : 'Variável'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={`px-6 py-4 text-right font-bold text-sm ${t.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {t.type === 'income' ? '+' : '-'} R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 transition-all">
                        <button 
                          onClick={() => handleEdit(t)}
                          className="p-2 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-all"
                          title="Editar"
                        >
                          <Pencil size={18} />
                        </button>
                        <button 
                          onClick={() => handlePrintReceipt(t)}
                          className="p-2 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-all"
                          title="Imprimir Recibo"
                        >
                          <Printer size={18} />
                        </button>
                        <button 
                          onClick={() => setDeleteConfirmId(t.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
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

        {/* Mobile View - Cards */}
        <div className="md:hidden divide-y divide-slate-100">
          {loading ? (
            <div className="p-8 text-center text-slate-400">Carregando...</div>
          ) : filteredTransactions.length === 0 ? (
            <div className="p-8 text-center text-slate-400">Nenhum lançamento.</div>
          ) : (
            filteredTransactions.map((t) => (
              <div key={t.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${t.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                      {t.type === 'income' ? <ArrowUpCircle size={20} /> : <ArrowDownCircle size={20} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-900 text-sm">{t.description}</p>
                        {t.isRecurring && <RefreshCw size={12} className="text-sky-600" />}
                      </div>
                      <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                        {(t.date as any).toDate ? (t.date as any).toDate().toLocaleDateString('pt-BR') : new Date(t.date).toLocaleDateString('pt-BR')}
                        {t.expenseType && ` • ${t.expenseType === 'fixed' ? 'Fixa' : 'Variável'}`}
                      </p>
                    </div>
                  </div>
                  <div className={`text-right font-black ${t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {t.type === 'income' ? '+' : '-'} R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-1">
                  <button 
                    onClick={() => handleToggleStatus(t.id, t.status || 'paid')}
                    className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all ${t.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700 ring-1 ring-amber-200'}`}
                  >
                    {t.status === 'paid' ? 'CONCLUÍDO' : 'PENDENTE'}
                  </button>
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(t)} className="p-2 bg-sky-50 text-sky-600 rounded-lg">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => handlePrintReceipt(t)} className="p-2 bg-slate-50 text-slate-500 rounded-lg">
                      <Printer size={16} />
                    </button>
                    <button onClick={() => setDeleteConfirmId(t.id)} className="p-2 bg-rose-50 text-rose-600 rounded-lg">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl transition-all">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Excluir Lançamento?</h3>
            <p className="text-sm text-slate-500 mb-6">Tem certeza que deseja remover este lançamento financeiro?</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirmId(null)} className="flex-1 btn-secondary">Cancelar</button>
              <button 
                onClick={() => handleDelete(deleteConfirmId)} 
                className="flex-1 py-2 rounded-xl bg-rose-600 text-white font-bold text-sm hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/20"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">{editingTransId ? 'Editar Lançamento' : 'Novo Lançamento'}</h3>
              <button 
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingTransId(null);
                }} 
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                FECHAR
              </button>
            </div>
            <form onSubmit={handleAddTransaction} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="flex gap-4 p-1 bg-slate-100 rounded-xl">
                <button 
                  type="button" onClick={() => setNewTrans({...newTrans, type: 'income'})}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${newTrans.type === 'income' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}
                >Receita</button>
                <button 
                  type="button" onClick={() => setNewTrans({...newTrans, type: 'expense'})}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${newTrans.type === 'expense' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500'}`}
                >Despesa</button>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
                <input type="text" required className="input-field" value={newTrans.description} onChange={e => setNewTrans({...newTrans, description: e.target.value})} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Valor (R$)</label>
                  <input type="number" step="0.01" required className="input-field" value={newTrans.amount} onChange={e => setNewTrans({...newTrans, amount: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Categoria</label>
                  <input type="text" required className="input-field" placeholder="Ex: Sessão, Aluguel" value={newTrans.category} onChange={e => setNewTrans({...newTrans, category: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <select 
                    className="input-field"
                    value={newTrans.status}
                    onChange={e => setNewTrans({...newTrans, status: e.target.value as 'paid' | 'pending'})}
                  >
                    <option value="paid">{newTrans.type === 'income' ? 'Recebido' : 'Pago'}</option>
                    <option value="pending">Pendente</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data</label>
                  <input type="date" required className="input-field" value={newTrans.date} onChange={e => setNewTrans({...newTrans, date: e.target.value})} />
                </div>
              </div>

              {newTrans.type === 'income' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Vincular Paciente (Opcional)</label>
                  <select 
                    className="input-field" 
                    value={newTrans.patientId} 
                    onChange={e => {
                      const p = patients.find(p => p.id === e.target.value);
                      setNewTrans({
                        ...newTrans, 
                        patientId: e.target.value,
                        patientName: p ? p.name : ''
                      });
                    }}
                  >
                    <option value="">Nenhum paciente</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {newTrans.type === 'expense' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tipo da Despesa</label>
                  <select 
                    className="input-field"
                    value={newTrans.expenseType}
                    onChange={e => setNewTrans({...newTrans, expenseType: e.target.value as 'fixed' | 'variable'})}
                  >
                    <option value="fixed">Despesa Fixa</option>
                    <option value="variable">Despesa Variável</option>
                  </select>
                </div>
              )}

              <div className="border-t border-slate-100 pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-700 font-bold text-sm">
                    <RefreshCw size={16} className="text-sky-600" />
                    Este lançamento é recorrente
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={newTrans.isRecurring} 
                      onChange={e => setNewTrans({...newTrans, isRecurring: e.target.checked})} 
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
                  </label>
                </div>

                {newTrans.isRecurring && (
                  <div className="bg-slate-50 p-4 rounded-2xl space-y-4 animate-in slide-in-from-top-2 duration-200">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Frequência</label>
                        <select 
                          className="input-field py-2 text-sm"
                          value={newTrans.frequency}
                          onChange={e => setNewTrans({...newTrans, frequency: e.target.value as any})}
                        >
                          <option value="daily">Diário</option>
                          <option value="weekly">Semanal</option>
                          <option value="monthly">Mensal</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Repetições</label>
                        <input 
                          type="number" 
                          placeholder="Ex: 12" 
                          className="input-field py-2 text-sm" 
                          value={newTrans.repetitions}
                          onChange={e => setNewTrans({...newTrans, repetitions: e.target.value})}
                        />
                        <p className="text-[9px] text-slate-400 mt-1 italic leading-tight">Vazio para recorrência contínua (12 meses)</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingTransId(null);
                  }} 
                  className="flex-1 btn-secondary"
                >
                  Cancelar
                </button>
                <button type="submit" className="flex-1 btn-primary">
                  {editingTransId ? 'Salvar Alterações' : 'Lançar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Series Action Modal */}
      {(seriesAction === 'delete' || seriesAction === 'edit') && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[110] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl space-y-6"
          >
            <div className={`${seriesAction === 'delete' ? 'bg-rose-50 text-rose-600' : 'bg-sky-50 text-sky-600'} w-16 h-16 rounded-2xl flex items-center justify-center mx-auto ring-8 ${seriesAction === 'delete' ? 'ring-rose-50/50' : 'ring-sky-50/50'}`}>
              <RefreshCw size={32} />
            </div>
            
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-bold text-slate-900">Lançamento Recorrente</h3>
              <p className="text-slate-500 text-sm">
                Este lançamento faz parte de uma série. O que deseja {seriesAction === 'delete' ? 'excluir' : 'editar'}?
              </p>
            </div>

            <div className="space-y-3">
              <button 
                onClick={() => {
                  if (seriesAction === 'delete') handleDelete(targetTrans!.id, 'single');
                  else handleAddTransaction(undefined, 'single');
                }}
                className={`w-full py-4 px-6 rounded-2xl border-2 border-slate-100 hover:border-${seriesAction === 'delete' ? 'rose' : 'sky'}-500 hover:bg-${seriesAction === 'delete' ? 'rose' : 'sky'}-50 text-left transition-all`}
              >
                <div className="font-bold text-slate-800">Apenas este</div>
              </button>

              <button 
                onClick={() => {
                  if (seriesAction === 'delete') handleDelete(targetTrans!.id, 'following');
                  else handleAddTransaction(undefined, 'following');
                }}
                className={`w-full py-4 px-6 rounded-2xl border-2 border-slate-100 hover:border-${seriesAction === 'delete' ? 'rose' : 'sky'}-500 hover:bg-${seriesAction === 'delete' ? 'rose' : 'sky'}-50 text-left transition-all`}
              >
                <div className="font-bold text-slate-800">Este e os próximos</div>
              </button>

              <button 
                onClick={() => {
                  if (seriesAction === 'delete') handleDelete(targetTrans!.id, 'all');
                  else handleAddTransaction(undefined, 'all');
                }}
                className={`w-full py-4 px-6 rounded-2xl border-2 border-slate-100 hover:border-${seriesAction === 'delete' ? 'rose' : 'sky'}-500 hover:bg-${seriesAction === 'delete' ? 'rose' : 'sky'}-50 text-left transition-all`}
              >
                <div className="font-bold text-slate-800">Toda a série</div>
              </button>
            </div>

            <button 
              onClick={() => {
                setSeriesAction(null);
                setTargetTrans(null);
              }} 
              className="w-full py-3 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-2xl transition-colors"
            >
              Cancelar
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
