import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
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
  signInWithGoogle: () => Promise<void>;
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

  const fetchProfileAndClinic = async (uid: string) => {
    try {
      const profileDoc = await getDoc(doc(db, 'users', uid));
      if (profileDoc.exists()) {
        const profileData = profileDoc.data() as UserProfile;
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
        await fetchProfileAndClinic(user.uid);
      } else {
        setProfile(null);
        setClinic(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      await fetchProfileAndClinic(result.user.uid);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, pass);
      await fetchProfileAndClinic(result.user.uid);
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
      });
      
      await fetchProfileAndClinic(result.user.uid);
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
      signInWithGoogle, signInWithEmail, signUpWithEmail,
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
