
import { useState } from 'react';


export default function CameraPage() {
  const [logs, setLogs] = useState([
    "[System] Initializing network stream...",
    "[System] Waiting for Wi-Fi connection..."
  ]);

  return (
    <div className="camera-container">
      <h2>Live Camera</h2>
      <img
        src="http://10.207.24.88:8080/video"
        alt="Camera Stream"
        className="video-feed"
        onError={(e) => {
          // Fallback to root or /stream if the default Android IP webcam /video path isn't right
          if (e.target.src.includes("/video")) {
            e.target.src = "http://10.207.24.88:8080/";
          } else if (!e.target.src.includes("/stream")) {
            e.target.src = "http://10.207.24.88:8080/stream";
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
        </div>
      </div>
    </div>
  );
}