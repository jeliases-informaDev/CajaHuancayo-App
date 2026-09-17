import { useEffect } from "react";
import { AppState } from "react-native";
import { io } from "socket.io-client";
import { API_URL } from "./api";
import { useAuth } from "./AuthContext";

const FIELD_EVENTS = [
  "muestra_actualizada",
  "visita_registrada",
  "ubicacion_actualizada",
];

export function useFieldRealtime(onChange: () => void) {
  const { token } = useAuth();

  useEffect(() => {
    if (!token) return;

    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(onChange, 250);
    };
    const socket = io(API_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    FIELD_EVENTS.forEach((event) => socket.on(event, scheduleRefresh));
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") scheduleRefresh();
    });

    return () => {
      subscription.remove();
      if (refreshTimer) clearTimeout(refreshTimer);
      FIELD_EVENTS.forEach((event) => socket.off(event, scheduleRefresh));
      socket.disconnect();
    };
  }, [token, onChange]);
}
