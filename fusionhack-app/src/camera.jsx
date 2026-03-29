import { useEffect, useRef, useState } from 'react';
import { Wifi, Scan } from 'lucide-react';
import * as tf from '@tensorflow/tfjs';
import * as mobilenet from '@tensorflow-models/mobilenet';
import * as knnClassifier from '@tensorflow-models/knn-classifier';

const IP_ADDRESS = "10.207.24.88:8080";

export default function CameraPage({ logs, isInspecting, inspectionScansLeft, setInspectionScansLeft, sendWsMessage }) {
  const logEndRef = useRef(null);
  const videoRef = useRef(null);
  const classifierRef = useRef(null);
  const mobilenetRef = useRef(null);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [history, setHistory] = useState([]);
  const [canScan, setCanScan] = useState(false);

  // Check logs for "Waiting for next plate."
  useEffect(() => {
    if (logs.length > 0 && !canScan) {
      const recentLogs = logs.slice(-3);
      if (recentLogs.some(log => log && log.includes("Waiting for next plate."))) {
        setCanScan(true);
      }
    }
  }, [logs, canScan]);

  // Auto-scroll the log window down when new messages arrive
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Load the inspection AI model when entering inspection mode
  useEffect(() => {
    async function loadAi() {
      try {
        console.log("Initializing local ML Engine for inspection...");
        if (!classifierRef.current) classifierRef.current = knnClassifier.create();
        if (!mobilenetRef.current) mobilenetRef.current = await mobilenet.load({ version: 2, alpha: 1.0 });

        const req = await fetch('/ai_model.json');
        if (!req.ok) throw new Error("Could not find ai_model.json in public folder");
        const importData = await req.json();

        // Safely dispose old model dataset if any
        try { classifierRef.current.clearAllClasses(); } catch(e){}

        const datasetObj = importData.modelData;
        const dataset = {};
        Object.keys(datasetObj).forEach(key => {
          dataset[key] = tf.tensor(datasetObj[key].data, datasetObj[key].shape);
        });
        classifierRef.current.setClassifierDataset(dataset);
        setModelLoaded(true);
        console.log("Inspection ML Dataset Applied successfully!");
      } catch (err) {
        console.error("Critical ML Setup Failure:", err);
      }
    }

    if (isInspecting && !modelLoaded) {
      loadAi();
    }
  }, [isInspecting, modelLoaded]);

  // Reset history at start of a new inspection
  useEffect(() => {
    if (isInspecting && inspectionScansLeft === 10) {
      setHistory([]);
      setCanScan(false);
    } else if (!isInspecting) {
      setHistory([]);
      setCanScan(false);
    }
  }, [isInspecting, inspectionScansLeft]);

  // The actual manual click function fired manually per interval
  async function predictFrame() {
    if (!isInspecting || !modelLoaded || !videoRef.current || !classifierRef.current) return;
    if (classifierRef.current.getNumClasses() === 0) return;
    if (inspectionScansLeft <= 0 || !canScan) return;

    try {
      const features = mobilenetRef.current.infer(videoRef.current, true);
      
      const exampleCounts = classifierRef.current.getClassExampleCount();
      const totalExamples = Object.values(exampleCounts).reduce((a, b) => a + b, 0);
      const k = Math.min(10, Math.max(1, totalExamples));

      const result = await classifierRef.current.predictClass(features, k);
      const conf = Math.round(result.confidences[result.label] * 100);
      
      setHistory(prev => [...prev, {
        id: 10 - inspectionScansLeft + 1,
        label: result.label, 
        confidence: conf
      }]);

      if (sendWsMessage) {
        sendWsMessage(result.label); // "damaged" or "undamaged"
      }
      setCanScan(false);
      
      features.dispose();
      
      setInspectionScansLeft(prev => prev - 1);
    } catch (err) {
      console.warn("Prediction frame failed:", err);
    }
  }

  const latestPrediction = history[history.length - 1];

  return (
    <div className="camera-container camera-page-wrapper">
      <h2>Live Camera</h2>
      <img
        ref={videoRef}
        src={`http://${IP_ADDRESS}/video`}
        alt="Camera Stream"
        crossOrigin="anonymous"
        className={`video-feed ${isInspecting && latestPrediction ? (latestPrediction.label === 'undamaged' ? 'border-undamaged' : 'border-damaged') : ''}`}
        onError={(e) => {
          // Fallback to root or /stream if the default Android IP webcam /video path isn't right
          if (e.target.src.includes("/video")) {
            e.target.src = `http://${IP_ADDRESS}/`;
          } else if (!e.target.src.includes("/stream")) {
            e.target.src = `http://${IP_ADDRESS}/stream`;
          }
        }}
      />

      {isInspecting && (
        <div className="camera-hud-overlay">
          <h3 className="camera-hud-title">
            <Scan size={20} style={{ marginRight: '8px' }} />
            AI Inspection (Live)
          </h3>
          
          <div className="camera-hud-section">
            {!modelLoaded ? (
              <p className="pulse" style={{ color: '#4c99f2', margin: 0 }}>Loading Neural Network...</p>
            ) : history.length === 0 ? (
              <p className="text-muted" style={{ margin: 0 }}>Awaiting First Scan...</p>
            ) : (
              <div>
                <strong style={{ fontSize: '1.2rem' }} className={latestPrediction?.label === 'undamaged' ? 'text-green' : 'text-red'}>
                  {latestPrediction?.label.toUpperCase()}
                </strong> 
                <span className="text-muted" style={{ marginLeft: '10px', fontSize: '0.9rem' }}>
                  {latestPrediction?.confidence}% match
                </span>
              </div>
            )}
          </div>

          <div className="camera-hud-section">
             <button
               onClick={predictFrame}
               disabled={!modelLoaded || inspectionScansLeft <= 0 || !canScan}
               className={`btn-scan ${modelLoaded && inspectionScansLeft > 0 && canScan ? 'active' : 'disabled'}`}
             >
               {!canScan && inspectionScansLeft > 0 ? "Waiting for ESP..." : `Scan Frame Now (${inspectionScansLeft} left)`}
             </button>
          </div>

          {history.length > 0 && (
            <div className="camera-hud-history">
              <div className="camera-hud-history-title">History ({history.length}/10)</div>
              {history.slice().reverse().map((entry, idx) => (
                <div key={idx} className="camera-hud-entry">
                  <span className="text-dark-muted">Scan {entry.id}</span>
                  <span className={entry.label === 'undamaged' ? 'text-green' : 'text-red'}>{entry.label}</span>
                  <span>{entry.confidence}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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