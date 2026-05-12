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
  Printer
} from 'lucide-react';
import { FinancialTransaction, Patient } from '../types';

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
    patientName: ''
  });

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
      handleFirestoreError(err, OperationType.GET, 'financialTransactions/patients');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [clinic]);

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinic) return;

    try {
      // Use mid-day to avoid timezone shifting issues when converting from date string
      const transactionDate = new Date(newTrans.date + 'T12:00:00');
      
      const payload = {
        ...newTrans,
        amount: Number(newTrans.amount),
        date: Timestamp.fromDate(transactionDate),
        clinicId: clinic.id,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'financialTransactions'), payload);
      setIsModalOpen(false);
      setNewTrans({
        type: 'income',
        category: '',
        amount: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
        status: 'paid',
        patientId: '',
        patientName: ''
      });
      fetchData();
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, 'financialTransactions');
    }
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

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'financialTransactions', id));
      setDeleteConfirmId(null);
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
            body { font-family: sans-serif; padding: 40px; color: #333; line-height: 1.6; }
            .receipt-container { border: 1px solid #e2e8f0; padding: 50px; border-radius: 16px; max-width: 700px; margin: 0 auto; box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1); position: relative; overflow: hidden; }
            .receipt-container::before { content: ""; position: absolute; top: 0; left: 0; width: 100%; height: 8px; background: #0284c7; }
            .header { display: flex; justify-content: space-between; align-items: start; border-bottom: 2px solid #f1f5f9; margin-bottom: 40px; padding-bottom: 20px; }
            .clinic-info h1 { margin: 0; color: #0f172a; font-size: 1.5em; }
            .clinic-info p { margin: 5px 0; color: #64748b; font-size: 0.9em; }
            .receipt-title { text-align: right; }
            .receipt-title h2 { margin: 0; color: #0284c7; letter-spacing: 2px; }
            .receipt-title p { margin: 5px 0; color: #94a3b8; font-weight: bold; }
            
            .content { margin-bottom: 40px; }
            .amount-box { background: #f0f9ff; border: 2px solid #bae6fd; padding: 20px; border-radius: 12px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
            .amount-label { color: #0369a1; font-weight: bold; text-transform: uppercase; font-size: 0.8em; }
            .amount-value { color: #0c4a6e; font-size: 2em; font-weight: 800; }
            
            .text-block { font-size: 1.1em; color: #334155; }
            .highlight { font-weight: bold; color: #0f172a; border-bottom: 1px dashed #cbd5e1; }
            
            .footer { margin-top: 60px; display: flex; flex-direction: column; align-items: center; gap: 40px; }
            .date-place { color: #64748b; font-size: 0.9em; }
            .signature-box { border-top: 1px solid #334155; min-width: 300px; text-align: center; padding-top: 10px; }
            .signature-box p { margin: 0; font-weight: bold; color: #0f172a; }
            .signature-box span { font-size: 0.8em; color: #64748b; }
            
            @media print {
              body { padding: 0; }
              .receipt-container { border: none; box-shadow: none; padding: 20px; }
            }
          </style>
        </head>
        <body>
          <div class="receipt-container">
            <div class="header">
              <div class="clinic-info">
                <h1>${clinic?.name || 'Clínica'}</h1>
                <p>Gestão de Saúde e Bem-estar</p>
              </div>
              <div class="receipt-title">
                <h2>RECIBO</h2>
                <p>Nº ${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}</p>
              </div>
            </div>
            
            <div class="content">
              <div class="amount-box">
                <span class="amount-label">Valor Recebido</span>
                <span class="amount-value">R$ ${t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              
              <p class="text-block">
                Recebemos de <span class="highlight">${t.patientName || '_______________________________________'}</span>,
                a quantia supracitada de <span class="highlight">R$ ${t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>,
                referente a <span class="highlight">${t.description || t.category}</span>.
              </p>
            </div>
            
            <div class="footer">
              <div class="date-place">
                ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(tDate)}
              </div>
              
              <div class="signature-box">
                <p>${clinic?.name || '__________________________'}</p>
                <span>Assinatura do Responsável</span>
              </div>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-sans">Financeiro</h1>
          <p className="text-slate-500">Controle o fluxo de caixa da sua clínica.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="btn-primary"
        >
          <Plus size={18} />
          Nova Lançamento
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="medical-card p-6 bg-white">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-slate-500">Receitas</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><TrendingUp size={20} /></div>
          </div>
          <h3 className="text-2xl font-bold text-slate-900">R$ {totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
        </div>
        <div className="medical-card p-6 bg-white">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-slate-500">Despesas</span>
            <div className="p-2 bg-red-50 text-red-600 rounded-lg"><TrendingDown size={20} /></div>
          </div>
          <h3 className="text-2xl font-bold text-slate-900">R$ {totalExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
        </div>
        <div className="medical-card p-6 bg-white border-l-4 border-l-rose-500">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-slate-500">Saldo Geral</span>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-lg"><DollarSign size={20} /></div>
          </div>
          <h3 className={`text-2xl font-bold ${balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
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
        <div className="overflow-x-auto">
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
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {(t.date as any).toDate ? (t.date as any).toDate().toLocaleDateString('pt-BR') : new Date(t.date).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => handleToggleStatus(t.id, t.status || 'paid')}
                        className={`
                          px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1
                          ${(t.status === 'paid' || !t.status) ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}
                        `}
                      >
                        {(t.status === 'paid' || !t.status) ? (t.type === 'income' ? 'Recebido' : 'Pago') : 'Pendente'}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {t.type === 'income' ? <ArrowUpCircle className="text-emerald-500" size={18} /> : <ArrowDownCircle className="text-red-500" size={18} />}
                        <div>
                          <p className="font-medium text-slate-800">{t.description}</p>
                          {t.patientName && <p className="text-[10px] text-sky-600 font-bold uppercase">{t.patientName}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider">
                        {t.category}
                      </span>
                    </td>
                    <td className={`px-6 py-4 text-right font-bold text-sm ${t.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {t.type === 'income' ? '+' : '-'} R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {t.type === 'income' && (
                          <button 
                            onClick={() => handlePrintReceipt(t)}
                            className="p-2 text-slate-300 hover:text-sky-600 transition-colors"
                            title="Imprimir Recibo"
                          >
                            <Printer size={18} />
                          </button>
                        )}
                        <button 
                          onClick={() => setDeleteConfirmId(t.id)}
                          className="p-2 text-slate-300 hover:text-red-600 transition-colors"
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
              <h3 className="text-xl font-bold text-slate-900">Novo Lançamento</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">FECHAR</button>
            </div>
            <form onSubmit={handleAddTransaction} className="p-6 space-y-4">
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
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Data</label>
                <input type="date" required className="input-field" value={newTrans.date} onChange={e => setNewTrans({...newTrans, date: e.target.value})} />
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
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 btn-secondary">Cancelar</button>
                <button type="submit" className="flex-1 btn-primary">Lançar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
