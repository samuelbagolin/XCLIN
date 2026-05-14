import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  limit, 
  orderBy,
  onSnapshot,
  Timestamp 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  Users, 
  Calendar as CalendarIcon, 
  TrendingUp, 
  Plus,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import { motion } from 'motion/react';

export function Dashboard() {
  const { clinic, profile } = useAuth();
  const [stats, setStats] = useState({
    patients: 0,
    appointmentsToday: 0,
    incomeMonth: 0,
    receivedMonth: 0,
    receivable: 0
  });
  const [recentAppointments, setRecentAppointments] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [birthdayPatients, setBirthdayPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartStartDate, setChartStartDate] = useState('');
  const [chartEndDate, setChartEndDate] = useState('');

  const isActive = clinic?.status === 'active' || profile?.role === 'super_admin';

  useEffect(() => {
    if (!clinic || !isActive) {
      setLoading(false);
      return;
    }
    setLoading(true);

    // Patients listener
    const pUnsub = onSnapshot(query(collection(db, 'patients'), where('clinicId', '==', clinic.id)), 
      (snap) => {
        const allPatients = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        setStats(prev => ({ ...prev, patients: allPatients.length }));
        
        // Birthday alerts
        const today = new Date();
        const brDay = today.getDate();
        const brMonth = today.getMonth() + 1;
        
        const birthdays = allPatients.filter(p => {
          if (!p.birthDate) return false;
          const parts = p.birthDate.split('-');
          if (parts.length !== 3) return false;
          const [_, month, day] = parts.map(Number);
          return day === brDay && month === brMonth;
        });
        setBirthdayPatients(birthdays);
      }, 
      (err) => handleFirestoreError(err, OperationType.GET, 'patients')
    );

    // Main Appointments listener (fetches all for processing to avoid index errors)
    const aUnsub = onSnapshot(query(collection(db, 'appointments'), where('clinicId', '==', clinic.id)), 
      (snap) => {
        const startToday = new Date();
        startToday.setHours(0,0,0,0);
        const endToday = new Date();
        endToday.setHours(23,59,59,999);

        const allApps = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        
        const appointmentsToday = allApps.filter(app => {
          const d = app.startTime?.toDate();
          return d >= startToday && d <= endToday;
        });

        const finalRecent = allApps
          .sort((a, b) => b.startTime.seconds - a.startTime.seconds)
          .slice(0, 5)
          .map(a => ({
            ...a,
            patientName: a.patientName || 'Paciente'
          }));

        setStats(prev => ({ ...prev, appointmentsToday: appointmentsToday.length }));
        setRecentAppointments(finalRecent);
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'appointments')
    );

    // Financial Transactions listener
    const fUnsub = onSnapshot(query(collection(db, 'financialTransactions'), where('clinicId', '==', clinic.id)), 
      (snap) => {
        const allTrans = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        const incomeTrans = allTrans.filter(t => t.type === 'income');

        const startTodayMonth = new Date();
        startTodayMonth.setDate(1);
        startTodayMonth.setHours(0,0,0,0);

        // Total receivable (all pending income ever)
        const totalReceivable = incomeTrans
          .filter(t => t.status === 'pending')
          .reduce((sum, t) => sum + (t.amount || 0), 0);

        // Monthly stats
        const monthTrans = incomeTrans.filter(t => t.date?.toDate() >= startTodayMonth);
        const thisMonthTotal = monthTrans.reduce((sum, t) => sum + (t.amount || 0), 0);
        const thisMonthReceived = monthTrans
          .filter(t => t.status === 'paid' || !t.status)
          .reduce((sum, t) => sum + (t.amount || 0), 0);

        // Process chart data
        const chartTrans = incomeTrans.filter(t => {
          const d = t.date?.toDate();
          if (!d) return false;
          if (chartStartDate && d < new Date(chartStartDate)) return false;
          if (chartEndDate && d > new Date(chartEndDate + 'T23:59:59')) return false;
          if (!chartStartDate && !chartEndDate) {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            return d >= thirtyDaysAgo;
          }
          return true;
        });

        const groupedData: Record<string, any> = {};
        chartTrans.forEach(t => {
          const d = t.date?.toDate();
          if (!d) return;
          const key = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
          if (!groupedData[key]) groupedData[key] = { name: key, total: 0 };
          groupedData[key].total += (t.amount || 0);
        });

        const formattedChartData = Object.values(groupedData)
          .sort((a, b) => a.name.split('/').reverse().join('') > b.name.split('/').reverse().join('') ? 1 : -1);

        setStats(prev => ({ 
          ...prev, 
          incomeMonth: thisMonthTotal,
          receivedMonth: thisMonthReceived,
          receivable: totalReceivable 
        }));
        setChartData(formattedChartData);
        setLoading(false);
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, 'financialTransactions');
        setLoading(false);
      }
    );

    return () => {
      pUnsub();
      aUnsub();
      fUnsub();
    };
  }, [clinic, chartStartDate, chartEndDate]);

  // Helper to get unique categories for bars
  const categories: string[] = chartData.length > 0 
    ? Array.from(new Set(chartData.flatMap(d => Object.keys(d).filter(k => k !== 'name')))) as string[]
    : [];

  const barColors = ['#0284c7', '#0ea5e9', '#38bdf8', '#7dd3fc', '#bae6fd'];

  if (loading) return <div className="p-8">Carregando painel...</div>;

  return (
    <div className="space-y-8">
      {/* Pending Approval / Blocked Banner */}
      {!isActive && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border-2 border-sky-100 rounded-3xl p-8 md:p-12 shadow-2xl shadow-sky-600/5 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <ShieldCheck size={120} className="text-sky-600" />
          </div>
          
          <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
            <div className="w-24 h-24 bg-sky-50 rounded-2xl flex items-center justify-center text-sky-600 shrink-0 shadow-inner">
              <Clock size={48} className="animate-pulse" />
            </div>
            
            <div className="text-center md:text-left flex-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-bold uppercase tracking-wider mb-4 border border-amber-100">
                <AlertCircle size={14} />
                Pendente de aprovação
              </div>
              <h2 className="text-3xl font-extrabold text-slate-900 mb-3 tracking-tight">Aguardando Liberação</h2>
              <p className="text-slate-600 text-lg leading-relaxed max-w-2xl">
                Seu cadastro foi recebido com sucesso. Nossa equipe está analisando sua clínica.
                Assim que a liberação for concluída, todos os módulos serão desbloqueados automaticamente.
              </p>
            </div>

            <div className="bg-sky-600 text-white px-6 py-4 rounded-2xl flex flex-col items-center justify-center min-w-[200px]">
              <p className="text-[10px] uppercase font-bold tracking-[0.2em] opacity-80 mb-1">Status Atual</p>
              <p className="text-xl font-bold tracking-tight">Análise em curso</p>
            </div>
          </div>
        </motion.div>
      )}

      {isActive ? (
        <>
          {/* Birthday Alerts */}
          {birthdayPatients.length > 0 && (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center shadow-inner">
                  <span className="text-2xl">🎂</span>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Aniversariantes de Hoje!</h3>
                  <p className="text-slate-600 text-sm">
                    Temos {birthdayPatients.length} {birthdayPatients.length === 1 ? 'paciente aniversariante' : 'pacientes aniversariantes'} hoje.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {birthdayPatients.map(p => (
                  <Link 
                    key={p.id} 
                    to={`/patients/${p.id}`}
                    className="bg-white border border-amber-200 px-3 py-1.5 rounded-lg text-sm font-semibold text-amber-700 hover:bg-amber-50 transition-colors flex items-center gap-2"
                  >
                    {p.name}
                    <ChevronRight size={14} />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Welcome Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Olá, {profile?.displayName?.split(' ')[0]}!</h1>
              <p className="text-slate-500">Isto é o que está acontecendo na {clinic?.name} hoje.</p>
            </div>
            <div className="flex gap-3">
              <Link to="/patients" className="btn-secondary">
                Ver Pacientes
              </Link>
              <Link to="/calendar" className="btn-primary">
                <Plus size={18} />
                Agendar Consulta
              </Link>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="medical-card p-5">
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs font-bold text-slate-500 uppercase">Pacientes</p>
                <div className="p-2 bg-sky-50 text-sky-600 rounded-lg"><Users size={18} /></div>
              </div>
              <h3 className="text-2xl font-bold text-slate-900">{stats.patients}</h3>
              <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold">Total cadastrados</p>
            </div>

            <div className="medical-card p-5">
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs font-bold text-slate-500 uppercase">Faturamento Mês</p>
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><TrendingUp size={18} /></div>
              </div>
              <h3 className="text-2xl font-bold text-slate-900">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.incomeMonth)}
              </h3>
              <p className="text-[10px] text-indigo-600 mt-1 uppercase font-bold">Previsto este mês</p>
            </div>

            <div className="medical-card p-5">
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs font-bold text-slate-500 uppercase">Total Recebido</p>
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><ArrowUpRight size={18} /></div>
              </div>
              <h3 className="text-2xl font-bold text-emerald-600">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.receivedMonth)}
              </h3>
              <p className="text-[10px] text-emerald-600 mt-1 uppercase font-bold">Já em caixa (mês)</p>
            </div>

            <div className="medical-card p-5">
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs font-bold text-slate-500 uppercase">A Receber</p>
                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><ArrowDownRight size={18} /></div>
              </div>
              <h3 className="text-2xl font-bold text-amber-600">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.receivable)}
              </h3>
              <p className="text-[10px] text-amber-600 mt-1 uppercase font-bold">Pendências totais</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Chart */}
            <div className="medical-card p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
                <h3 className="font-bold text-slate-900">Evolução Financeira</h3>
                <div className="flex items-center gap-2">
                  <input 
                    type="date" 
                    className="text-xs bg-slate-100 border-none rounded-lg py-1 px-2 focus:ring-0"
                    value={chartStartDate}
                    onChange={e => setChartStartDate(e.target.value)}
                  />
                  <span className="text-slate-400 text-xs">-</span>
                  <input 
                    type="date" 
                    className="text-xs bg-slate-100 border-none rounded-lg py-1 px-2 focus:ring-0"
                    value={chartEndDate}
                    onChange={e => setChartEndDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="h-64 w-full bg-white rounded-xl overflow-hidden">
                <ResponsiveContainer width="99%" height={256}>
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 12 }}
                      dy={10}
                    />
                    <YAxis hide />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      formatter={(value) => [`R$ ${Number(value).toLocaleString('pt-BR')}`, 'Total Recebido']}
                    />
                    <Bar 
                      dataKey="total" 
                      fill="#0284c7" 
                      radius={[4, 4, 0, 0]} 
                      barSize={40} 
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Recent Appointments */}
            <div className="medical-card flex flex-col">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-900">Agendamentos Recentes</h3>
                <Link to="/calendar" className="text-sky-600 text-sm font-medium hover:underline flex items-center gap-1">
                  Ver todos
                  <ChevronRight size={16} />
                </Link>
              </div>
              <div className="flex-1 overflow-y-auto">
                {recentAppointments.length === 0 ? (
                  <div className="p-12 text-center text-slate-400">
                    Sem agendamentos recentes.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {recentAppointments.map((app) => (
                      <div key={app.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
                            {app.patientName?.charAt(0) || 'P'}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{app.patientName || 'Paciente'}</p>
                            <p className="text-xs text-slate-500">
                              {app.startTime?.toDate().toLocaleDateString()} às {app.startTime?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                        <span className={`
                          px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider
                          ${app.status === 'scheduled' ? 'bg-sky-100 text-sky-700' : 
                            app.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 
                            app.status === 'waiting' ? 'bg-amber-100 text-amber-700' :
                            'bg-slate-100 text-slate-600'}
                        `}>
                          {app.status === 'scheduled' ? 'Agendado' : app.status === 'completed' ? 'Concluído' : app.status === 'waiting' ? 'Aguardando' : 'Outro'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 opacity-40">
           {[1,2,3,4].map(i => (
             <div key={i} className="medical-card p-5 h-32 bg-slate-100/50"></div>
           ))}
        </div>
      )}
    </div>
  );
}
