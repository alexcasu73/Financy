"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { api } from "./api";

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  onNotification: (callback: (notification: any) => void) => () => void;
}

const SocketContext = createContext<SocketContextType | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const token = api.getToken();
    if (!token) return;

    const socketInstance = io(process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001", {
      path: "/ws",
      auth: { token },
      transports: ["websocket", "polling"],
    });

    socketInstance.on("connect", () => {
      console.log("WebSocket connected");
      setIsConnected(true);
    });

    socketInstance.on("disconnect", () => {
      console.log("WebSocket disconnected");
      setIsConnected(false);
    });

    socketInstance.on("connect_error", (error) => {
      console.error("WebSocket connection error:", error.message);
      setIsConnected(false);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  const onNotification = useCallback((callback: (notification: any) => void) => {
    if (!socket) return () => {};

    socket.on("notification", callback);
    return () => {
      socket.off("notification", callback);
    };
  }, [socket]);

  return (
    <SocketContext.Provider value={{ socket, isConnected, onNotification }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within SocketProvider");
  }
  return context;
}
