import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { Stethoscope, Chrome, Mail, Lock, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';

export function Login() {
  const { user, profile, signInWithGoogle, signInWithEmail, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!loading && user && profile) {
    return <Navigate to="/" replace />;
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await signInWithEmail(email, password);
    } catch (err: any) {
      setError('E-mail ou senha incorretos.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Left side: branding/image */}
      <div className="hidden lg:flex w-1/2 bg-sky-600 p-12 text-white items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl"></div>
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full translate-x-1/2 translate-y-1/2 blur-3xl"></div>
        </div>
        
        <div className="max-w-md space-y-8 relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-10">
              <Stethoscope size={32} className="text-white" />
            </div>
            <h1 className="text-5xl font-bold font-sans tracking-tight leading-tight">
              A gestão inteligente para sua clínica.
            </h1>
            <p className="text-sky-100 text-lg mt-6 leading-relaxed">
              XCLIN centraliza pacientes, agenda e financeiro em uma única plataforma elegante e intuitiva.
            </p>
          </motion.div>
          <div className="pt-12 grid grid-cols-2 gap-6">
            <div className="p-4 bg-white/10 rounded-2xl border border-white/10">
              <p className="text-2xl font-bold">100%</p>
              <p className="text-sky-200 text-xs uppercase font-bold tracking-wider mt-1">Seguro</p>
            </div>
            <div className="p-4 bg-white/10 rounded-2xl border border-white/10">
              <p className="text-2xl font-bold">Cloud</p>
              <p className="text-sky-200 text-xs uppercase font-bold tracking-wider mt-1">Sempre Online</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right side: login form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <motion.div 
          className="w-full max-w-sm space-y-8"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Bem-vindo de volta</h2>
            <p className="text-slate-500 mt-2">Acesse sua conta para gerenciar sua clínica.</p>
          </div>

          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="email" 
                  required 
                  placeholder="exemplo@clinica.com"
                  className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="password" 
                  required 
                  placeholder="••••••••"
                  className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>
            </div>

            {error && <p className="text-xs font-medium text-rose-600 bg-rose-50 p-3 rounded-lg">{error}</p>}

            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full btn-primary py-3 rounded-xl text-md shadow-lg shadow-sky-600/20 flex items-center justify-center gap-2 group"
            >
              {isSubmitting ? 'Entrando...' : 'Entrar na conta'}
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-slate-50 px-3 text-slate-400 font-bold">Ou continue com</span></div>
          </div>

          <button 
            onClick={signInWithGoogle}
            className="w-full bg-white border border-slate-200 text-slate-700 font-bold py-3 rounded-xl flex items-center justify-center gap-3 hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Chrome size={20} className="text-sky-600" />
            Entrar com Google
          </button>
        </motion.div>
      </div>
    </div>
  );
}
