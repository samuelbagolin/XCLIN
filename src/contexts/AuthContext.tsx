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
  signUpWithEmail: (email: string, pass: string, name: string, phone: string, role: any, clinicId: string) => Promise<void>;
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
        
        // Super Admin Auto-Upgrade
        const superAdminEmail = 'samuel.g.bagolin@hotmail.com';
        if (email === superAdminEmail && profileData.role !== 'super_admin') {
          profileData.role = 'super_admin';
          profileData.status = 'active';
          try {
            await setDoc(doc(db, 'users', uid), { 
              role: 'super_admin',
              status: 'active'
            }, { merge: true });
          } catch (e) {
            console.error("Failed to auto-upgrade super admin:", e);
          }
        }
        
        if (profileData.clinicId && profileData.clinicId !== '') {
          try {
            const clinicDoc = await getDoc(doc(db, 'clinics', profileData.clinicId));
            if (clinicDoc.exists()) {
              const clinicData = clinicDoc.data() as Clinic;
              setClinic({ id: clinicDoc.id, ...clinicData } as Clinic);
              setProfile(profileData);
            } else {
              setProfile(profileData);
              setClinic(null);
            }
          } catch (e) {
            console.error("Error fetching clinic:", e);
            setProfile(profileData);
            setClinic(null);
          }
        } else {
          setProfile(profileData);
          setClinic(null);
        }
      } else {
        // If profile doesn't exist but it's the Super Admin email, create it
        const superAdminEmail = 'samuel.g.bagolin@hotmail.com';
        if (email === superAdminEmail) {
          const newProfile: UserProfile = {
            uid,
            email: email,
            displayName: 'Admin Master',
            role: 'super_admin',
            clinicId: '',
            status: 'active'
          };
          try {
            await setDoc(doc(db, 'users', uid), {
              ...newProfile,
              createdAt: serverTimestamp()
            });
            setProfile(newProfile);
            setClinic(null);
          } catch (e) {
            console.error("Failed to create super admin profile:", e);
            setProfile(null);
          }
        } else {
          setProfile(null);
          setClinic(null);
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

  const signUpWithEmail = async (email: string, pass: string, name: string, phone: string, role: any, clinicId: string) => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(result.user, { displayName: name });
      
      const newProfile: UserProfile = {
        uid: result.user.uid,
        email,
        displayName: name,
        phone,
        role,
        clinicId,
        status: 'pending'
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
