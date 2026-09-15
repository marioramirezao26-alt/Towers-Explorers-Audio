import { initializeApp } from 'firebase-admin/app';

initializeApp();

export { researchWithOpenAI } from './research';
export { transcribeVoiceNote } from './transcribe';
export { deviceCommand } from './device';
