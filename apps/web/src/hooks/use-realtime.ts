'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { io } from 'socket.io-client';
import type { RealtimeMessage } from '../lib/types';

const REALTIME_URL = process.env.NEXT_PUBLIC_REALTIME_URL ?? 'http://localhost:4001';

export function useRealtime(address: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!address) return;
    const socket = io(REALTIME_URL, { transports: ['websocket', 'polling'] });
    socket.emit('portfolio:subscribe', address);

    const onMessage = (message: RealtimeMessage) => {
      if (message.address !== address) return;
      if (message.event === 'portfolio.updated') {
        void queryClient.invalidateQueries({ queryKey: ['portfolio', address] });
      }
      if (message.event === 'risk.updated') {
        void queryClient.invalidateQueries({ queryKey: ['risk', address] });
      }
      if (message.event === 'alert.triggered' || message.event === 'policy.breached') {
        void queryClient.invalidateQueries({ queryKey: ['alerts', address] });
      }
    };

    socket.on('riskrail:event', onMessage);
    return () => {
      socket.off('riskrail:event', onMessage);
      socket.emit('portfolio:unsubscribe', address);
      socket.disconnect();
    };
  }, [address, queryClient]);
}
