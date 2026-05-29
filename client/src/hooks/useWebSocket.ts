import { useEffect, useRef, useCallback } from 'react';
import { WS_URL } from '../lib/api';

type MessageHandler = (data: any) => void;

export const useWebSocket = (onMessage: MessageHandler) => {
  const ws = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    ws.current = new WebSocket(WS_URL);

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      onMessageRef.current(data);
    };

    ws.current.onerror = (err) => console.error('WebSocket error:', err);

    return () => {
      ws.current?.close();
    };
  }, []);

  const send = useCallback((payload: object) => {
    if (!ws.current) return;
    if (ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(payload));
    } else if (ws.current.readyState === WebSocket.CONNECTING) {
      ws.current.addEventListener('open', () => {
        ws.current?.send(JSON.stringify(payload));
      }, { once: true });
    }
  }, []);

  return { send };
};