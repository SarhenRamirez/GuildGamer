import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuth } from '../auth/AuthContext';
import type { AppNotification } from '../lib/types';

interface Realtime {
  chat: Socket | null;
  toasts: AppNotification[];
  dismissToast: (id: string) => void;
}

const RealtimeContext = createContext<Realtime>({ chat: null, toasts: [], dismissToast: () => {} });

export const connectNamespace = (namespace: string, token: string) =>
  io(namespace, { auth: { token }, transports: ['websocket'] });

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [chat, setChat] = useState<Socket | null>(null);
  const [toasts, setToasts] = useState<AppNotification[]>([]);

  useEffect(() => {
    if (!token) return;
    const chatSocket = connectNamespace('/chat', token);
    const notifSocket = connectNamespace('/notifications', token);
    setChat(chatSocket);

    notifSocket.on('notification:new', (n: AppNotification) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      if (n.data?.sessionId) queryClient.invalidateQueries({ queryKey: ['session', n.data.sessionId] });
      if (n.type.startsWith('FRIEND')) queryClient.invalidateQueries({ queryKey: ['friends'] });
      if (n.type === 'PREMIUM_ACTIVATED') queryClient.invalidateQueries({ queryKey: ['subscription'] });
      if (n.type !== 'NEW_MESSAGE') {
        setToasts((t) => [...t.slice(-3), n]);
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== n.id)), 6000);
      }
    });
    chatSocket.on('dm:new', () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    });

    return () => {
      chatSocket.disconnect();
      notifSocket.disconnect();
      setChat(null);
    };
  }, [token, queryClient]);

  return (
    <RealtimeContext.Provider
      value={{ chat, toasts, dismissToast: (id) => setToasts((t) => t.filter((x) => x.id !== id)) }}
    >
      {children}
    </RealtimeContext.Provider>
  );
}

export const useRealtime = () => useContext(RealtimeContext);
