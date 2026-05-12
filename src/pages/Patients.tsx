import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Search, Plus, UserPlus, Phone, Mail, Calendar as CalendarIcon, ChevronRight, Edit2, Trash2, MessageSquare, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Patient } from '../types';

export function Patients() {
  const { clinic } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPatientId, setEditingPatientId] = useState<string|null>(null);
  const [loading, setLoading] = useState(true);

  // New patient state
  const [newPatient, setNewPatient] = useState({
    name: '',
    email: '',
    phone: '',
    birthDate: '',
    type: 'adult' as 'adult' | 'child',
    cpf: '',
    fatherName: '',
    motherName: '',
    address: {
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: '',
      zipCode: ''
    }
  });
  const [includeAddress, setIncludeAddress] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchPatients = async () => {
    if (!clinic) return;
    try {
      const q = query(collection(db, 'patients'), where('clinicId', '==', clinic.id));
      const snap = await getDocs(q);
      setPatients(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient)));
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'patients');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, [clinic]);

  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinic) return;

    try {
      if (editingPatientId) {
        await updateDoc(doc(db, 'patients', editingPatientId), {
          ...newPatient,
          address: includeAddress ? newPatient.address : null,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'patients'), {
          ...newPatient,
          address: includeAddress ? newPatient.address : null,
          clinicId: clinic.id,
          createdAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
      setEditingPatientId(null);
      setNewPatient({ 
        name: '', 
        email: '', 
        phone: '', 
        birthDate: '',
        type: 'adult',
        fatherName: '',
        motherName: '',
        address: { street: '', number: '', complement: '', neighborhood: '', city: '', state: '', zipCode: '' }
      });
      setIncludeAddress(false);
      fetchPatients();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'patients');
    }
  };

  const handleDeletePatient = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'patients', id));
      fetchPatients();
      setConfirmDeleteId(null);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, `patients/${id}`);
    }
  };

  const handleEditPatient = (patient: Patient) => {
    setEditingPatientId(patient.id);
    setNewPatient({
      name: patient.name,
      email: patient.email || '',
      phone: patient.phone || '',
      birthDate: patient.birthDate || '',
      type: patient.type || 'adult',
      cpf: patient.cpf || '',
      fatherName: patient.fatherName || '',
      motherName: patient.motherName || '',
      address: patient.address || { street: '', number: '', complement: '', neighborhood: '', city: '', state: '', zipCode: '' }
    });
    setIncludeAddress(!!patient.address);
    setIsModalOpen(true);
  };

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.phone.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-sans">Pacientes</h1>
          <p className="text-slate-500">Gerencie o cadastro de seus pacientes.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="btn-primary"
        >
          <UserPlus size={18} />
          Novo Paciente
        </button>
      </div>

      <div className="medical-card">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por nome, email ou telefone..."
              className="w-full bg-white border border-slate-200 rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                <th className="px-6 py-4">Nome</th>
                <th className="px-6 py-4">Contato</th>
                <th className="px-6 py-4">Data Nasc.</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400">Carregando...</td></tr>
              ) : filteredPatients.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400">Nenhum paciente encontrado.</td></tr>
              ) : (
                filteredPatients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-sm">
                          {patient.name.charAt(0)}
                        </div>
                        <span className="font-medium text-slate-900">{patient.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Mail size={12} />
                          {patient.email}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Phone size={12} />
                          {patient.phone}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {patient.birthDate.split('-').reverse().join('/')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {patient.phone && (
                          <a 
                            href={`https://wa.me/${patient.phone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-colors"
                            title="WhatsApp"
                          >
                            <MessageSquare size={18} />
                          </a>
                        )}
                        <Link 
                          to={`/patients/${patient.id}`}
                          className="p-2 hover:bg-sky-50 text-sky-600 rounded-lg transition-colors"
                          title="Prontuário"
                        >
                          <ChevronRight size={20} />
                        </Link>
                        <button 
                          onClick={() => handleEditPatient(patient)}
                          className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => setConfirmDeleteId(patient.id)}
                          className="p-2 hover:bg-rose-50 text-rose-600 rounded-lg transition-colors"
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
      </div>

      {/* Confirmation Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Excluir Paciente?</h3>
            <p className="text-sm text-slate-500 mb-6">Tem certeza que deseja excluir este paciente? Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteId(null)} className="flex-1 btn-secondary">Cancelar</button>
              <button 
                onClick={() => handleDeletePatient(confirmDeleteId)} 
                className="flex-1 py-2 rounded-xl bg-rose-600 text-white font-bold text-sm hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/20"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Patient Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">
                {editingPatientId ? 'Editar Paciente' : 'Novo Paciente'}
              </h3>
              <button 
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingPatientId(null);
                  setNewPatient({ 
                    name: '', 
                    email: '', 
                    phone: '', 
                    birthDate: '',
                    type: 'adult',
                    cpf: '',
                    fatherName: '',
                    motherName: '',
                    address: { street: '', number: '', complement: '', neighborhood: '', city: '', state: '', zipCode: '' }
                  });
                  setIncludeAddress(false);
                }} 
                className="text-slate-400 hover:text-slate-600"
              >
                <Plus className="rotate-45" size={24} />
              </button>
            </div>
            <form onSubmit={handleAddPatient} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div 
                  onClick={() => setNewPatient({...newPatient, type: 'adult'})}
                  className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex flex-col items-center gap-2 ${newPatient.type === 'adult' ? 'border-sky-500 bg-sky-50' : 'border-slate-100 hover:border-slate-200'}`}
                >
                  <span className="text-2xl">👨‍💼</span>
                  <span className={`text-xs font-bold ${newPatient.type === 'adult' ? 'text-sky-700' : 'text-slate-500'}`}>Adulto</span>
                </div>
                <div 
                  onClick={() => setNewPatient({...newPatient, type: 'child'})}
                  className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex flex-col items-center gap-2 ${newPatient.type === 'child' ? 'border-sky-500 bg-sky-50' : 'border-slate-100 hover:border-slate-200'}`}
                >
                  <span className="text-2xl">🧒</span>
                  <span className={`text-xs font-bold ${newPatient.type === 'child' ? 'text-sky-700' : 'text-slate-500'}`}>Criança</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo</label>
                <input 
                  type="text" required className="input-field" 
                  value={newPatient.name} onChange={e => setNewPatient({...newPatient, name: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">CPF (Opcional)</label>
                <input 
                  type="text" className="input-field" 
                  value={newPatient.cpf} onChange={e => setNewPatient({...newPatient, cpf: e.target.value})}
                  placeholder="000.000.000-00"
                />
              </div>

              {newPatient.type === 'child' && (
                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Pai (Opcional)</label>
                    <input 
                      type="text" className="input-field" 
                      value={newPatient.fatherName} onChange={e => setNewPatient({...newPatient, fatherName: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nome da Mãe (Opcional)</label>
                    <input 
                      type="text" className="input-field" 
                      value={newPatient.motherName} onChange={e => setNewPatient({...newPatient, motherName: e.target.value})}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">E-mail (Opcional)</label>
                  <input 
                    type="email" className="input-field" 
                    value={newPatient.email} onChange={e => setNewPatient({...newPatient, email: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Telefone / WhatsApp (Opcional)</label>
                  <input 
                    type="text" className="input-field" 
                    value={newPatient.phone} onChange={e => setNewPatient({...newPatient, phone: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Data de Nascimento (Opcional)</label>
                <input 
                  type="date" className="input-field" 
                  value={newPatient.birthDate} onChange={e => setNewPatient({...newPatient, birthDate: e.target.value})}
                />
              </div>

              {/* Address Toggle */}
              <div className="pt-2">
                <button 
                  type="button"
                  onClick={() => setIncludeAddress(!includeAddress)}
                  className={`flex items-center gap-2 text-sm font-semibold transition-colors ${includeAddress ? 'text-sky-600' : 'text-slate-500'}`}
                >
                  <div className={`w-10 h-5 rounded-full relative transition-colors ${includeAddress ? 'bg-sky-500' : 'bg-slate-300'}`}>
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-transform ${includeAddress ? 'translate-x-6' : 'translate-x-1'}`} />
                  </div>
                  Cadastrar Endereço?
                </button>
              </div>

              {includeAddress && (
                <div className="space-y-4 pt-2 border-t border-slate-50 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2">
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Logradouro</label>
                      <input 
                        type="text" className="input-field text-sm" placeholder="Rua, Av..."
                        value={newPatient.address.street} 
                        onChange={e => setNewPatient({...newPatient, address: {...newPatient.address, street: e.target.value}})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nº</label>
                      <input 
                        type="text" className="input-field text-sm" 
                        value={newPatient.address.number} 
                        onChange={e => setNewPatient({...newPatient, address: {...newPatient.address, number: e.target.value}})}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Complemento</label>
                      <input 
                        type="text" className="input-field text-sm" 
                        value={newPatient.address.complement} 
                        onChange={e => setNewPatient({...newPatient, address: {...newPatient.address, complement: e.target.value}})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Bairro</label>
                      <input 
                        type="text" className="input-field text-sm" 
                        value={newPatient.address.neighborhood} 
                        onChange={e => setNewPatient({...newPatient, address: {...newPatient.address, neighborhood: e.target.value}})}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Cidade</label>
                      <input 
                        type="text" className="input-field text-sm" 
                        value={newPatient.address.city} 
                        onChange={e => setNewPatient({...newPatient, address: {...newPatient.address, city: e.target.value}})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Estado</label>
                      <input 
                        type="text" className="input-field text-sm" placeholder="UF"
                        value={newPatient.address.state} 
                        onChange={e => setNewPatient({...newPatient, address: {...newPatient.address, state: e.target.value}})}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4 flex gap-3 sticky bottom-0 bg-white pb-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 btn-secondary">Cancelar</button>
                <button type="submit" className="flex-1 btn-primary">{editingPatientId ? 'Salvar' : 'Cadastrar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
