import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { Stethoscope, Mail, Lock, ArrowRight, Phone } from 'lucide-react';
import { motion } from 'motion/react';

export function Login() {
  const { user, profile, signInWithEmail, signUpWithEmail, loading } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  if (!loading && user && profile) {
    return <Navigate to="/" replace />;
  }

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      let formatted = numbers;
      if (numbers.length > 2) {
        formatted = `(${numbers.substring(0, 2)}) ${numbers.substring(2)}`;
      }
      if (numbers.length > 7) {
        formatted = `(${numbers.substring(0, 2)}) ${numbers.substring(2, 7)}-${numbers.substring(7, 11)}`;
      }
      return formatted.substring(0, 15);
    }
    return value.substring(0, 15);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsSubmitting(true);
    try {
      if (isSignUp) {
        if (phone.length < 14) {
          setError('Informe um telefone válido.');
          setIsSubmitting(false);
          return;
        }
        // Sign up as clinic owner (initial setup)
        await signUpWithEmail(email, password, name, phone, 'clinic_admin', ''); 
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('Este e-mail já está em uso.');
      } else if (err.code === 'auth/weak-password') {
        setError('A senha deve ter pelo menos 6 caracteres.');
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('E-mail ou senha incorretos.');
      } else {
        setError('Ocorreu um erro. Tente novamente.');
      }
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Informe seu e-mail para recuperar a senha.');
      return;
    }
    setError('');
    setMessage('');
    setIsSubmitting(true);
    try {
      const { sendPasswordResetEmail } = await import('firebase/auth');
      const { auth } = await import('../lib/firebase');
      await sendPasswordResetEmail(auth, email);
      setMessage('Link de recuperação enviado para o seu e-mail.');
    } catch (err: any) {
      setError('Erro ao enviar e-mail de recuperação: ' + err.message);
    } finally {
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
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
              {isSignUp ? 'Crie sua conta' : 'Bem-vindo de volta'}
            </h2>
            <p className="text-slate-500 mt-2">
              {isSignUp ? 'Comece a gerenciar sua clínica hoje mesmo.' : 'Acesse sua conta para gerenciar sua clínica.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Nome Completo</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text" 
                      required 
                      placeholder="Seu nome"
                      className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                      value={name}
                      onChange={e => setName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Telefone / WhatsApp</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text" 
                      required 
                      placeholder="(00) 00000-0000"
                      className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                      value={phone}
                      onChange={e => setPhone(formatPhone(e.target.value))}
                    />
                  </div>
                </div>
              </>
            )}
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

            <div className="space-y-4">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Senha</label>
                  <button 
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-xs font-bold text-sky-600 hover:text-sky-700 transition-colors"
                    disabled={isSubmitting}
                  >
                    Esqueceu a senha?
                  </button>
                </div>
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
            </div>

          {error && <p className="text-xs font-medium text-rose-600 bg-rose-50 p-3 rounded-lg">{error}</p>}
          {message && <p className="text-xs font-medium text-emerald-600 bg-emerald-50 p-3 rounded-lg">{message}</p>}

            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full btn-primary py-3 rounded-xl text-md shadow-lg shadow-sky-600/20 flex items-center justify-center gap-2 group"
            >
              {isSubmitting ? (isSignUp ? 'Criando...' : 'Entrando...') : (isSignUp ? 'Criar minha conta' : 'Entrar na conta')}
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>

            <div className="text-center">
              <button 
                type="button" 
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-xs font-bold text-sky-600 hover:text-sky-700 transition-colors"
                disabled={isSubmitting}
              >
                {isSignUp ? 'Já tem uma conta? Entre aqui' : 'Não tem uma conta? Registre sua clínica'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
