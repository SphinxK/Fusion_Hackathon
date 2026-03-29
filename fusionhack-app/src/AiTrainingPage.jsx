import { useEffect, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as mobilenet from '@tensorflow-models/mobilenet';
import * as knnClassifier from '@tensorflow-models/knn-classifier';

const IP_ADDRESS = "10.207.24.88:8080";
// --- Simple IndexedDB Wrapper to bypass LocalStorage limits ---
const openDB = () => new Promise((resolve, reject) => {
  const req = indexedDB.open("AiTrainingDB", 1);
  req.onupgradeneeded = (e) => e.target.result.createObjectStore("models");
  req.onsuccess = (e) => resolve(e.target.result);
  req.onerror = () => reject(req.error);
});

const saveToDB = async (key, value) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains("models")) return reject(new Error("models store missing"));
    const tx = db.transaction("models", "readwrite");
    tx.objectStore("models").put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

const loadFromDB = async (key) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains("models")) return resolve(null);
    const tx = db.transaction("models", "readonly");
    const req = tx.objectStore("models").get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};

const deleteFromDB = async (key) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains("models")) return resolve();
    const tx = db.transaction("models", "readwrite");
    tx.objectStore("models").delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export default function AiTrainingPage() {
  const videoRef = useRef(null);
  const classifierRef = useRef(null);
  const mobilenetRef = useRef(null);
  const requestRef = useRef(null); // For the prediction loop
  const modelsReadyRef = useRef(false);

  const [isReady, setIsReady] = useState(false);
  const [startupChoice, setStartupChoice] = useState(null); // 'browser' or 'file'
  const [prediction, setPrediction] = useState("Awaiting Data...");
  const [confidence, setConfidence] = useState(0);
  const [trainingCounts, setTrainingCounts] = useState({ undamaged: 0, damaged: 0 });

  useEffect(() => {
    if (!startupChoice) return;

    async function setupAiAndCamera() {
      try {
        // 1. Load the AI Models
        console.log("Loading AI Models...");
        if (!classifierRef.current) {
          classifierRef.current = knnClassifier.create();
        }
        mobilenetRef.current = await mobilenet.load({ version: 2, alpha: 1.0 });
        console.log("Models Loaded!");
        modelsReadyRef.current = true;

        if (startupChoice === 'browser') {
          // Try to load saved model from IndexedDB safely
          try {
            const savedModel = await loadFromDB('knnModel');
            const savedCounts = await loadFromDB('knnCounts');
            if (savedModel && savedCounts) {
              const datasetObj = savedModel;
              const dataset = {};
              Object.keys(datasetObj).forEach(key => {
                let newKey = key;
                if (key === 'clean') newKey = 'undamaged';
                if (key === 'dirty') newKey = 'damaged';
                dataset[newKey] = tf.tensor(datasetObj[key].data, datasetObj[key].shape);
              });
              classifierRef.current.setClassifierDataset(dataset);
              
              setTrainingCounts({
                undamaged: savedCounts.undamaged !== undefined ? savedCounts.undamaged : (savedCounts.clean || 0),
                damaged: savedCounts.damaged !== undefined ? savedCounts.damaged : (savedCounts.dirty || 0)
              });
              console.log("Loaded saved model from previous session!");
            }
          } catch (dbErr) {
            console.warn("Browser DB load failed or missing:", dbErr);
          }
        }

        // Check if stream image is already loaded (it might load faster than models)
        if (videoRef.current && videoRef.current.complete && videoRef.current.naturalHeight !== 0) {
          setIsReady(true);
          startPredicting();
        }
      } catch (err) {
        console.error("Setup failed:", err);
      }
    }

    setupAiAndCamera();

    // Cleanup when leaving the page
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [startupChoice, isReady]);

  // --- Core AI Functions ---

  // Capture a frame and tell the AI what it's looking at
  const addTrainingExample = (classLabel) => {
    if (!videoRef.current || !mobilenetRef.current || !classifierRef.current) return;

    // Get the mathematical "features" of the current video frame
    const features = mobilenetRef.current.infer(videoRef.current, true);
    
    // Add those features to our custom classifier
    classifierRef.current.addExample(features, classLabel);
    
    // Update UI counts simply (no heavy saving on every frame)
    setTrainingCounts(prev => ({ ...prev, [classLabel]: prev[classLabel] + 1 }));
  };

  // Continuously look at the camera and guess what it sees
  const startPredicting = async () => {
    try {
      if (classifierRef.current && classifierRef.current.getNumClasses() > 0) {
        const features = mobilenetRef.current.infer(videoRef.current, true);
        
        // Determine K dynamically based on total examples for better confidence granularity
        const exampleCounts = classifierRef.current.getClassExampleCount();
        const totalExamples = Object.values(exampleCounts).reduce((a, b) => a + b, 0);
        const k = Math.min(10, Math.max(1, totalExamples));
        
        const result = await classifierRef.current.predictClass(features, k);

        setPrediction(result.label);
        setConfidence(Math.round(result.confidences[result.label] * 100));
        
        // Memory cleanup for TensorFlow
        features.dispose(); 
      }
    } catch (e) {
      console.warn("Skipping frame prediction:", e.message);
    }
    // Loop this function to keep guessing on the next video frame
    requestRef.current = requestAnimationFrame(startPredicting);
  };

  const saveModel = async () => {
    if (!classifierRef.current) return;
    try {
      const dataset = classifierRef.current.getClassifierDataset();
      const datasetObj = {};
      Object.keys(dataset).forEach(key => {
        const tensor = dataset[key];
        datasetObj[key] = {
          data: Array.from(tensor.dataSync()),
          shape: tensor.shape
        };
      });
      await saveToDB('knnModel', datasetObj);
      await saveToDB('knnCounts', trainingCounts);
      alert("AI Model saved successfully! It will now persist when you leave the page.");
    } catch (e) {
      console.error("Failed to save model:", e);
      alert("Failed to save model. Database error occurred.");
    }
  };

  const clearModel = async () => {
    try {
      if (classifierRef.current) {
        // We recreate instead of clearAllClasses which can hit race conditions with inference
        try { classifierRef.current.dispose(); } catch(e){}
        classifierRef.current = knnClassifier.create();
        
        setTrainingCounts({ undamaged: 0, damaged: 0 });
        
        try {
          await deleteFromDB('knnModel');
          await deleteFromDB('knnCounts');
        } catch (dbErr) {
          console.warn("Cleared memory, but DB clear was skipped or failed:", dbErr);
        }
        
        setPrediction("Awaiting Data...");
        setConfidence(0);
      }
    } catch (e) {
      console.error("Crash prevented during model clear:", e);
      alert("Error while clearing model. See console.");
    }
  };

  const exportModel = async () => {
    if (!classifierRef.current || classifierRef.current.getNumClasses() === 0) {
      alert("No model data to export.");
      return;
    }
    try {
      const dataset = classifierRef.current.getClassifierDataset();
      const datasetObj = {};
      Object.keys(dataset).forEach(key => {
        const tensor = dataset[key];
        datasetObj[key] = {
          data: Array.from(tensor.dataSync()),
          shape: tensor.shape
        };
      });
      const exportData = {
        modelData: datasetObj,
        countsData: trainingCounts
      };
      
      const blob = new Blob([JSON.stringify(exportData)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ai_plate_model_${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Export error:", e);
      alert("Failed to export model.");
    }
  };

  const importModel = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const importData = JSON.parse(text);
      if (!importData || !importData.modelData || !importData.countsData) {
        throw new Error("Invalid model file structure.");
      }

      // Recreate classifier safely
      try { classifierRef.current.dispose(); } catch(err){}
      classifierRef.current = knnClassifier.create();

      const datasetObj = importData.modelData;
      const dataset = {};
      Object.keys(datasetObj).forEach(key => {
        dataset[key] = tf.tensor(datasetObj[key].data, datasetObj[key].shape);
      });
      classifierRef.current.setClassifierDataset(dataset);
      
      setTrainingCounts(importData.countsData);
      
      // Save it to DB automatically on import
      await saveToDB('knnModel', datasetObj);
      await saveToDB('knnCounts', importData.countsData);
      
      setPrediction("Awaiting Data...");
      setConfidence(0);
      alert("Model imported and saved successfully!");
    } catch (err) {
      console.error("Import error:", err);
      if (!classifierRef.current) classifierRef.current = knnClassifier.create();
      alert("Failed to import model: " + err.message);
    }
    
    // Reset file input
    e.target.value = null;
  };

  const handleInitialImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const importData = JSON.parse(text);
      if (!importData || !importData.modelData || !importData.countsData) {
        throw new Error("Invalid model file structure.");
      }

      // Recreate classifier safely
      try { if (classifierRef.current) classifierRef.current.dispose(); } catch(err){}
      classifierRef.current = knnClassifier.create();

      const datasetObj = importData.modelData;
      const dataset = {};
      Object.keys(datasetObj).forEach(key => {
        dataset[key] = tf.tensor(datasetObj[key].data, datasetObj[key].shape);
      });
      classifierRef.current.setClassifierDataset(dataset);
      
      setTrainingCounts(importData.countsData);
      
      // Save it to DB automatically on import
      try {
        await saveToDB('knnModel', datasetObj);
        await saveToDB('knnCounts', importData.countsData);
      } catch (e) {}
      
      setPrediction("Awaiting Data...");
      setConfidence(0);
      setStartupChoice('file');
    } catch (err) {
      console.error("Initial import error:", err);
      if (!classifierRef.current) classifierRef.current = knnClassifier.create();
      alert("Failed to import model: " + err.message);
    }
    
    e.target.value = null;
  };

  if (!startupChoice) {
    return (
      <div className="camera-container" style={{ padding: '20px', textAlign: 'center' }}>
        <h2>Initialize AI Inspection</h2>
        <div style={styles.resultBox}>
          <p style={{ marginBottom: '20px' }}>Select an option to load the AI Brain before running the camera.</p>
          <div style={styles.buttonRow}>
            <button style={styles.btnSave} onClick={() => setStartupChoice('browser')}>
              Start / Load from Browser
            </button>
            <label style={styles.btnImport}>
              Import Model from File
              <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleInitialImport} />
            </label>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="camera-container">
      <h2>AI Plate Inspection</h2>
      
      {!isReady && <p className="pulse">Loading Neural Network & Camera Stream...</p>}

      <img
        ref={videoRef}
        src={`http://${IP_ADDRESS}/video`}
        alt="Camera Stream"
        crossOrigin="anonymous"
        className="video-feed"
        style={{ border: prediction === 'undamaged' ? '4px solid #34c759' : prediction === 'damaged' ? '4px solid #ff3b30' : 'none' }}
        onLoad={() => {
          if (modelsReadyRef.current && !isReady) {
            setIsReady(true);
            startPredicting();
          }
        }}
        onError={(e) => {
          // Fallback to root or /stream if the default Android IP webcam /video path isn't right
          if (e.target.src.includes("/video")) {
            e.target.src = `http://${IP_ADDRESS}/`;
          } else if (!e.target.src.includes("/stream")) {
            e.target.src = `http://${IP_ADDRESS}/stream`;
          }
        }}
      />

      {isReady && (
        <div style={styles.controls}>
          <div style={styles.buttonRow}>
            <button style={styles.btnUndamaged} onClick={() => addTrainingExample('undamaged')}>
             Train Undamaged ({trainingCounts.undamaged})
            </button>
            <button style={styles.btnDamaged} onClick={() => addTrainingExample('damaged')}>
             Train Damaged ({trainingCounts.damaged})
            </button>
          </div>

          <div style={styles.buttonRow}>
            <button style={styles.btnSave} onClick={saveModel}>
              Save to Browser
            </button>
            <button style={styles.btnClear} onClick={clearModel}>
              Clear Model
            </button>
          </div>

          <div style={styles.buttonRow}>
            <button style={styles.btnExport} onClick={exportModel}>
              Export to File
            </button>
            <label style={styles.btnImport}>
              Import from File
              <input type="file" accept=".json" style={{ display: 'none' }} onChange={importModel} />
            </label>
          </div>

          <div style={styles.resultBox}>
            <h3>AI Sees: <strong>{prediction.toUpperCase()}</strong></h3>
            <p>Confidence: {confidence}%</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Simple inline styles for the AI controls
const styles = {
  controls: { marginTop: '20px', width: '100%', maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '15px' },
  buttonRow: { display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' },
  btnUndamaged: { padding: '12px 24px', backgroundColor: '#34c759', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' },
  btnDamaged: { padding: '12px 24px', backgroundColor: '#ff3b30', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' },
  btnSave: { padding: '8px 16px', backgroundColor: '#007aff', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' },
  btnClear: { padding: '8px 16px', backgroundColor: '#8e8e93', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' },
  btnExport: { padding: '8px 16px', backgroundColor: '#5ac8fa', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' },
  btnImport: { padding: '8px 16px', backgroundColor: '#ff9500', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', display: 'inline-block' },
  resultBox: { padding: '15px', backgroundColor: '#fff', borderRadius: '8px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', color: '#333' }
};