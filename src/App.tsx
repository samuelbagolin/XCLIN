import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Patients } from './pages/Patients';
import { PatientDetails } from './pages/PatientDetails';
import { Calendar } from './pages/Calendar';
import { Professionals } from './pages/Professionals';
import { Financial } from './pages/Financial';
import { Settings } from './pages/Settings';
import { Onboarding } from './pages/Onboarding';

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) {
  const { user, profile, loading } = useAuth();
  
  if (loading) return <div className="h-screen w-screen flex items-center justify-center font-sans">Carregando...</div>;
  if (!user) return <Navigate to="/login" />;
  
  if (!profile) return <Navigate to="/onboarding" />;
  
  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/" />;
  }
  
  return <Layout>{children}</Layout>;
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
          <Route path="/professionals" element={<ProtectedRoute allowedRoles={['clinic_admin', 'receptionist']}><Professionals /></ProtectedRoute>} />
          <Route path="/financial" element={<ProtectedRoute allowedRoles={['clinic_admin', 'financial']}><Financial /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute allowedRoles={['clinic_admin']}><Settings /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
