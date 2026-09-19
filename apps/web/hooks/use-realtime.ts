"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import type { RealtimeMessage } from "@/lib/types";

const REALTIME_URL =
  process.env.NEXT_PUBLIC_REALTIME_URL ?? "http://localhost:4001";

/**
 * Socket events are a signal to refetch, never the source of truth — the API
 * stays authoritative. `onEvent` lets the page show that something arrived,
 * which the previous version invalidated silently.
 */
export function useRealtime(
  address: string | null,
  onEvent?: (message: RealtimeMessage) => void,
) {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    if (!address) return;

    const socket = io(REALTIME_URL, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
    });

    const onConnect = () => {
      setConnected(true);
      socket.emit("portfolio:subscribe", address);
    };
    const onDisconnect = () => setConnected(false);

    const onMessage = (message: RealtimeMessage) => {
      if (message.address !== address) return;

      if (message.event === "portfolio.updated") {
        void queryClient.invalidateQueries({ queryKey: ["portfolio", address] });
      }
      if (message.event === "risk.updated") {
        void queryClient.invalidateQueries({ queryKey: ["risk", address] });
      }
      if (message.event === "alert.triggered" || message.event === "policy.breached") {
        void queryClient.invalidateQueries({ queryKey: ["alerts", address] });
      }

      handlerRef.current?.(message);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("riskrail:event", onMessage);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("riskrail:event", onMessage);
      socket.emit("portfolio:unsubscribe", address);
      socket.disconnect();
    };
  }, [address, queryClient]);

  return { connected };
}
