import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Patients } from './pages/Patients';
import { PatientDetails } from './pages/PatientDetails';
import { Calendar } from './pages/Calendar';
import { Professionals } from './pages/Professionals';
import { Financial } from './pages/Financial';
import { Settings } from './pages/Settings';
import { Onboarding } from './pages/Onboarding';
import { AdminMaster } from './pages/AdminMaster';
import Documents from './pages/Documents';
import SignaturePage from './pages/SignaturePage';

import { ShieldAlert, LogOut } from 'lucide-react';

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) {
  const { user, profile, clinic, loading, logout } = useAuth();
  
  if (loading) return <div className="h-screen w-screen flex items-center justify-center font-sans text-slate-400">Carregando...</div>;
  if (!user) return <Navigate to="/login" />;
  
  // Allow super_admin to skip clinic checks if they want, 
  // but usually they will have a shadow clinic or just access stats.
  if (profile?.role === 'super_admin') {
    return (
      <Layout>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </Layout>
    );
  }

  if (!profile) return <Navigate to="/onboarding" />;
  if (profile && !profile.clinicId) return <Navigate to="/onboarding" />;

  // Blocked or Cancelled clinics get the hard stop
  if (clinic && (clinic.status === 'blocked' || clinic.status === 'cancelled')) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-3xl flex items-center justify-center mb-8 shadow-xl shadow-rose-600/10">
          <ShieldAlert size={40} />
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 mb-3 tracking-tight">Acesso Suspenso</h1>
        <p className="text-slate-600 max-w-sm text-lg leading-relaxed">
          Esta conta de clínica foi suspensa ou bloqueada. Entre em contato com o suporte para mais informações.
        </p>
        <div className="mt-10 flex flex-col gap-3 w-full max-w-xs">
          <button 
            onClick={() => window.location.reload()}
            className="btn-primary py-4 rounded-2xl shadow-lg shadow-sky-600/20"
          >
            Verificar novamente
          </button>
          <button 
            onClick={async () => {
              await logout();
              window.location.href = '/login';
            }}
            className="text-slate-500 font-bold hover:text-slate-700 py-3 transition-colors text-sm flex items-center justify-center gap-2"
          >
            <LogOut size={16} />
            Sair da conta
          </button>
        </div>
      </div>
    );
  }
  
  // Check roles
  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/" />;
  }
  
  return (
    <Layout>
      <ErrorBoundary>
        {children}
      </ErrorBoundary>
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/patients" element={<ProtectedRoute><Patients /></ProtectedRoute>} />
          <Route path="/patients/:id" element={<ProtectedRoute><PatientDetails /></ProtectedRoute>} />
          <Route path="/calendar" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
          <Route path="/professionals" element={<ProtectedRoute allowedRoles={['clinic_admin', 'receptionist', 'super_admin']}><Professionals /></ProtectedRoute>} />
          <Route path="/financial" element={<ProtectedRoute allowedRoles={['clinic_admin', 'financial', 'super_admin']}><Financial /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute allowedRoles={['clinic_admin', 'super_admin']}><Settings /></ProtectedRoute>} />
          <Route path="/documents" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
          <Route path="/admin-master" element={<ProtectedRoute allowedRoles={['super_admin']}><AdminMaster /></ProtectedRoute>} />
          <Route path="/sign/:id" element={<SignaturePage />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
