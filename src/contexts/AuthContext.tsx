import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signOut,
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile, Clinic } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  clinic: Clinic | null;
  loading: boolean;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, name: string, role: any, clinicId: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfileAndClinic = async (uid: string, email?: string | null) => {
    try {
      const profileDoc = await getDoc(doc(db, 'users', uid));
      let profileData: UserProfile | null = null;

      if (profileDoc.exists()) {
        profileData = profileDoc.data() as UserProfile;
        
        // Principal Admin Auto-Upgrade
        const principalAdminEmail = 'samuel.g.bagolin@hotmail.com';
        if (email === principalAdminEmail && profileData.role !== 'clinic_admin') {
          profileData.role = 'clinic_admin';
          await setDoc(doc(db, 'users', uid), { role: 'clinic_admin' }, { merge: true });
        }
        
        setProfile(profileData);
        
        if (profileData.clinicId) {
          const clinicDoc = await getDoc(doc(db, 'clinics', profileData.clinicId));
          if (clinicDoc.exists()) {
            setClinic({ id: clinicDoc.id, ...clinicDoc.data() } as Clinic);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching profile/clinic:', error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        await fetchProfileAndClinic(user.uid, user.email);
      } else {
        setProfile(null);
        setClinic(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithEmail = async (email: string, pass: string) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, pass);
      await fetchProfileAndClinic(result.user.uid, result.user.email);
    } catch (error) {
      console.error('Email login error:', error);
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, pass: string, name: string, role: any, clinicId: string) => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(result.user, { displayName: name });
      
      const newProfile: UserProfile = {
        uid: result.user.uid,
        email,
        displayName: name,
        role,
        clinicId
      };
      
      await setDoc(doc(db, 'users', result.user.uid), {
        ...newProfile,
        createdAt: serverTimestamp()
      }, { merge: true });
      
      await fetchProfileAndClinic(result.user.uid, result.user.email);
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const refreshProfile = async () => {
    if (user) await fetchProfileAndClinic(user.uid);
  };

  return (
    <AuthContext.Provider value={{ 
      user, profile, clinic, loading, 
      signInWithEmail, signUpWithEmail,
      logout, refreshProfile 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
