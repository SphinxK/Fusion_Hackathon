import { useEffect, useRef, useState } from 'react';
import { Wifi } from 'lucide-react';
const IP_ADDRESS = "10.207.5.199:8080";

export default function CameraPage() {
  const [logs, setLogs] = useState([
    "[System] Initializing network stream...",
    "[System] Waiting for Wi-Fi connection..."
  ]);
  const logEndRef = useRef(null);

  // Auto-scroll the log window down when new messages arrive
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Handle WebSocket connection
  useEffect(() => {
    const ws = new WebSocket("ws://172.30.181.173:82");

    ws.onopen = () => {
      setLogs(prev => {
        const next = [...prev, "[System] WebSocket connected to ESP32."];
        return next.length > 100 ? next.slice(next.length - 100) : next;
      });
    };

    ws.onmessage = (event) => {
      let messageEntry = event.data;

      // Try to parse the standard ESP32 log format we made
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.level && parsed.message) {
          messageEntry = `[${parsed.level}] ${parsed.message}`;
        }
      } catch (e) { }

      setLogs((prevLogs) => {
        const nextLogs = [...prevLogs, messageEntry];
        return nextLogs.length > 100 ? nextLogs.slice(nextLogs.length - 100) : nextLogs;
      });
    };

    ws.onclose = () => {
      setLogs(prev => {
        const next = [...prev, "[System] WebSocket disconnected."];
        return next.length > 100 ? next.slice(next.length - 100) : next;
      });
    };

    ws.onerror = () => {
      setLogs(prev => {
        const next = [...prev, "[System] WebSocket connection error."];
        return next.length > 100 ? next.slice(next.length - 100) : next;
      });
    };

    return () => {
      ws.close();
    };
  }, []);

  return (
    <div className="camera-container">
      <h2>Live Camera</h2>
      <img
        src={`http://${IP_ADDRESS}/video`}
        alt="Camera Stream"
        className="video-feed"
        onError={(e) => {
          // Fallback to root or /stream if the default Android IP webcam /video path isn't right
          if (e.target.src.includes("/video")) {
            e.target.src = `http://${IP_ADDRESS}/`;
          } else if (!e.target.src.includes("/stream")) {
            e.target.src = `http://${IP_ADDRESS}/stream`;
          }
        }}
      />

      {/* Network Log Section */}
      <div className="log-container">
        <div className="log-header">
          <h3><Wifi size={24} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Wi-Fi Logs</h3>
          <span className="log-status pulse">Listening</span>
        </div>
        <div className="log-window">
          {logs.map((log, index) => (
            <div key={index} className="log-entry">{log}</div>
          ))}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
}