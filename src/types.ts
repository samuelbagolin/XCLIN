export type UserRole = 'clinic_admin' | 'professional' | 'receptionist' | 'patient' | 'financial' | 'secretary';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  clinicId: string;
  professionalId?: string;
  photoURL?: string;
}

export interface Clinic {
  id: string;
  name: string;
  logoUrl?: string;
  address?: string;
  phone?: string;
  ownerId: string;
}

export interface Specialty {
  id: string;
  name: string;
}

export interface Professional {
  id: string;
  name: string;
  email: string;
  specialties: string[]; // IDs of specialties
  clinicId: string;
  active: boolean;
}

export interface Patient {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  birthDate?: string;
  clinicId: string;
  type?: 'adult' | 'child';
  fatherName?: string;
  motherName?: string;
  cpf?: string;
  address?: {
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
  createdAt: any;
}

export type DocumentType = 'service_contract' | 'school_visit' | 'cancellation_policy';
export type DocumentStatus = 'pending' | 'sent' | 'viewed' | 'signed' | 'refused' | 'expired';

export interface Document {
  id: string;
  clinicId: string;
  patientId: string;
  patientName: string;
  type: DocumentType;
  title: string;
  content: string;
  status: DocumentStatus;
  value?: number;
  signedAt?: any;
  signedBy?: string;
  signatureIp?: string;
  sentAt?: any;
  viewedAt?: any;
  createdAt: any;
  updatedAt: any;
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName?: string; // Denormalized for convenience
  professionalId: string;
  professionalName?: string; // Denormalized for convenience
  startTime: any; // Timestamp
  endTime: any; // Timestamp
  status: 'scheduled' | 'completed' | 'cancelled' | 'no-show' | 'waiting';
  type: string;
  clinicId: string;
  notes?: string;
}

export interface MedicalRecord {
  id: string;
  patientId: string;
  professionalId: string;
  professionalName?: string;
  date: any; // Timestamp
  content: string;
  category: 'evaluation' | 'evolution' | 'document';
  clinicId: string;
}

export interface FinancialTransaction {
  id: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  date: any; // Timestamp
  description: string;
  status: 'paid' | 'pending';
  patientId?: string;
  patientName?: string;
  linkedAppointmentId?: string;
  clinicId: string;
}
