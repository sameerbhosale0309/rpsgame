import { io } from 'socket.io-client';

const rawBackendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
const BACKEND_URL = rawBackendUrl.replace(/\/+$/, '');

export const socket = io(BACKEND_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  transports: ['websocket', 'polling'],
});
