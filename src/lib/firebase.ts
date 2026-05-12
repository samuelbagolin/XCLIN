import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMessage = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  
  console.error('Firestore Error Details: ', JSON.stringify(errInfo));

  // Determine user friendly message
  let userFriendly = "Não foi possível carregar os dados no momento.";
  
  if (errMessage.includes("index")) {
    userFriendly = "O sistema está sendo otimizado para sua clínica. Por favor, aguarde alguns instantes e tente novamente.";
  } else if (errMessage.includes("permission-denied")) {
    userFriendly = "Você não possui permissão para realizar esta ação ou visualizar estes dados.";
  } else if (errMessage.includes("quota")) {
    userFriendly = "O limite de uso diário foi atingido. O serviço será restabelecido em breve.";
  }

  // Use a professional alert or throw for ErrorBoundary to catch
  const professionalError = new Error(userFriendly);
  (professionalError as any).originalError = errInfo;
  
  throw professionalError;
}
