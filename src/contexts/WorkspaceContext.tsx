import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Workspace } from '@/types';
import { useAuth } from './AuthContext';

interface WorkspaceContextValue {
  workspace: Workspace | null;
  loading: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.workspaceId) {
      setWorkspace(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = onSnapshot(doc(db, 'workspaces', profile.workspaceId), (snap) => {
      setWorkspace(snap.exists() ? (snap.data() as Workspace) : null);
      setLoading(false);
    });
    return unsubscribe;
  }, [profile?.workspaceId]);

  const value = useMemo(() => ({ workspace, loading }), [workspace, loading]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace debe usarse dentro de WorkspaceProvider');
  return ctx;
}
