import {
  arrayUnion,
  collection,
  doc,
  getDocs,
  limit,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Workspace } from '@/types';

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin caracteres ambiguos
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function createWorkspace(name: string, ownerUid: string): Promise<string> {
  const ref = doc(collection(db, 'workspaces'));
  const workspace: Workspace = {
    id: ref.id,
    name,
    inviteCode: generateInviteCode(),
    memberIds: [ownerUid],
    createdAt: Date.now(),
  };
  await setDoc(ref, workspace);
  await updateDoc(doc(db, 'users', ownerUid), { workspaceId: ref.id });
  return ref.id;
}

export async function joinWorkspaceByInviteCode(inviteCode: string, uid: string): Promise<string> {
  const q = query(
    collection(db, 'workspaces'),
    where('inviteCode', '==', inviteCode.trim().toUpperCase()),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) {
    throw new Error('No encontramos un espacio de trabajo con ese código de invitación.');
  }
  const workspaceDoc = snap.docs[0];
  await updateDoc(workspaceDoc.ref, { memberIds: arrayUnion(uid) });
  await updateDoc(doc(db, 'users', uid), { workspaceId: workspaceDoc.id });
  return workspaceDoc.id;
}
