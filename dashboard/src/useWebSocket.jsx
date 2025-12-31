import { useEffect, useRef, useState } from 'react';

// Simple WebSocket hook used by the JCB simulator.
// - url: WebSocket URL to connect to (e.g. ws://192.168.8.100:8080)
// Returns the latest parsed message as `controls` (or null while disconnected).
export default function useWebSocket(url) {
  const wsRef = useRef(null);
  const [controls, setControls] = useState(null);

  useEffect(() => {
    if (!url) return;

    let mounted = true;

    try {
      wsRef.current = new WebSocket(url);
    } catch (err) {
      // Invalid URL or environment doesn't support websocket
      console.error('useWebSocket: failed to create WebSocket', err);
      return;
    }

    const ws = wsRef.current;

    ws.onopen = () => {
      console.log('[useWebSocket] connected to', url);
    };

    ws.onmessage = (evt) => {
      // Expect the server to send JSON with control values. Support text, Blob and ArrayBuffer.
      const handle = async () => {
        try {
          let raw = evt.data;

          if (raw instanceof Blob) {
            // modern browsers support blob.text()
            if (typeof raw.text === 'function') {
              raw = await raw.text();
            } else {
              // fallback to FileReader
              raw = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsText(raw);
              });
            }
          } else if (raw instanceof ArrayBuffer) {
            raw = new TextDecoder().decode(raw);
          }

          // At this point raw should be a string
          const data = JSON.parse(raw);
          if (mounted) setControls(data);
        } catch (parseErr) {
          // If message isn't JSON, ignore or handle accordingly
          // Include the type to make debugging easier
          console.warn('[useWebSocket] received non-JSON message (type:', typeof evt.data, evt.data, ')', parseErr);
        }
      };

      handle();
    };

    ws.onclose = (evt) => {
      console.log('[useWebSocket] closed', evt.code, evt.reason);
    };

    ws.onerror = (err) => {
      console.error('[useWebSocket] error', err);
    };

    return () => {
      mounted = false;
      try {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.close();
        }
      } catch (closeErr) {
        // ignore
        console.warn('[useWebSocket] error while closing', closeErr);
      }
      wsRef.current = null;
    };
  }, [url]);

  return controls;
}
