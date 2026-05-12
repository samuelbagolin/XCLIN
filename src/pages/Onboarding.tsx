import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc, addDoc, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserRole } from '../types';
import { Building2, Plus, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';

export function Onboarding() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [clinicName, setClinicName] = useState('');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (profile && profile.clinicId) navigate('/');
  }, [profile, navigate]);

  const handleCreateClinic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !clinicName) return;

    setLoading(true);
    try {
      // 1. Create clinic
      const clinicRef = await addDoc(collection(db, 'clinics'), {
        name: clinicName,
        ownerId: user.uid,
        status: 'active',
        createdAt: new Date()
      });

      // 2. Create user profile
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || 'Usuário',
        role: 'clinic_admin' as UserRole,
        clinicId: clinicRef.id,
        createdAt: new Date()
      }, { merge: true });

      await refreshProfile();
      navigate('/');
    } catch (error) {
      console.error('Error during onboarding:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-xl w-full"
      >
        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold text-slate-900 mb-3">Quase lá!</h1>
          <p className="text-slate-600 text-lg">Para começar, precisamos configurar sua clínica.</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 md:p-12">
          <form onSubmit={handleCreateClinic} className="space-y-8">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3 ml-1">
                Nome da sua Clínica
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <Building2 size={20} />
                </div>
                <input
                  type="text"
                  required
                  placeholder="Ex: Clínica Sonhos & Sons"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-medium"
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !clinicName}
              className="w-full btn-primary py-4 text-lg rounded-2xl shadow-lg shadow-sky-600/20 disabled:opacity-50 disabled:shadow-none"
            >
              {loading ? 'Criando...' : (
                <>
                  Criar minha Clínica
                  <ArrowRight size={20} />
                </>
              )}
            </button>
          </form>
          
          <div className="mt-8 pt-8 border-t border-slate-100 text-center">
            <p className="text-sm text-slate-500">
              Você será o administrador desta clínica. Poderá convidar outros profissionais e secretários depois.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
