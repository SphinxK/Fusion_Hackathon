import { useEffect, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as mobilenet from '@tensorflow-models/mobilenet';
import * as knnClassifier from '@tensorflow-models/knn-classifier';

export default function AiTrainingPage() {
  const videoRef = useRef(null);
  const classifierRef = useRef(null);
  const mobilenetRef = useRef(null);
  const requestRef = useRef(null); // For the prediction loop

  const [isReady, setIsReady] = useState(false);
  const [prediction, setPrediction] = useState("Awaiting Data...");
  const [confidence, setConfidence] = useState(0);
  const [trainingCounts, setTrainingCounts] = useState({ clean: 0, dirty: 0 });

  useEffect(() => {
    let mediaStream = null;

    async function setupAiAndCamera() {
      try {
        // 1. Load the AI Models
        console.log("Loading AI Models...");
        classifierRef.current = knnClassifier.create();
        mobilenetRef.current = await mobilenet.load({ version: 2, alpha: 1.0 });
        console.log("Models Loaded!");

        // Try to load saved model from localStorage
        const savedModel = localStorage.getItem('knnModel');
        const savedCounts = localStorage.getItem('knnCounts');
        if (savedModel && savedCounts) {
          try {
            const datasetObj = JSON.parse(savedModel);
            const dataset = {};
            Object.keys(datasetObj).forEach(key => {
              dataset[key] = tf.tensor(datasetObj[key].data, datasetObj[key].shape);
            });
            classifierRef.current.setClassifierDataset(dataset);
            setTrainingCounts(JSON.parse(savedCounts));
            console.log("Loaded saved model from previous session!");
          } catch (e) {
            console.error("Failed to load saved model:", e);
          }
        }

        // 2. Start the Webcam
        mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          // We must wait for the video to actually start playing before predicting
          videoRef.current.onloadeddata = () => {
            setIsReady(true);
            startPredicting(); 
          };
        }
      } catch (err) {
        console.error("Setup failed:", err);
      }
    }

    setupAiAndCamera();

    // Cleanup when leaving the page
    return () => {
      if (mediaStream) mediaStream.getTracks().forEach(track => track.stop());
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  // --- Core AI Functions ---

  // Capture a frame and tell the AI what it's looking at
  const addTrainingExample = (classLabel) => {
    if (!videoRef.current || !mobilenetRef.current || !classifierRef.current) return;

    // Get the mathematical "features" of the current video frame
    const features = mobilenetRef.current.infer(videoRef.current, true);
    
    // Add those features to our custom classifier
    classifierRef.current.addExample(features, classLabel);
    
    // Update UI counts and save to localStorage
    setTrainingCounts(prev => {
      const newCounts = { ...prev, [classLabel]: prev[classLabel] + 1 };
      
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
        localStorage.setItem('knnModel', JSON.stringify(datasetObj));
        localStorage.setItem('knnCounts', JSON.stringify(newCounts));
      } catch (e) {
        console.error("Failed to save model:", e);
      }

      return newCounts;
    });
  };

  // Continuously look at the camera and guess what it sees
  const startPredicting = async () => {
    if (classifierRef.current.getNumClasses() > 0) {
      const features = mobilenetRef.current.infer(videoRef.current, true);
      const result = await classifierRef.current.predictClass(features);

      setPrediction(result.label);
      setConfidence(Math.round(result.confidences[result.label] * 100));
      
      // Memory cleanup for TensorFlow
      features.dispose(); 
    }
    // Loop this function to keep guessing on the next video frame
    requestRef.current = requestAnimationFrame(startPredicting);
  };

  const clearModel = () => {
    if (classifierRef.current) {
      classifierRef.current.clearAllClasses();
      setTrainingCounts({ clean: 0, dirty: 0 });
      localStorage.removeItem('knnModel');
      localStorage.removeItem('knnCounts');
      setPrediction("Awaiting Data...");
      setConfidence(0);
    }
  };

  return (
    <div className="camera-container">
      <h2>AI Plate Inspection</h2>
      
      {!isReady && <p className="pulse">Loading Neural Network...</p>}

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="video-feed"
        style={{ border: prediction === 'clean' ? '4px solid #34c759' : prediction === 'dirty' ? '4px solid #ff3b30' : 'none' }}
      />

      {isReady && (
        <div style={styles.controls}>
          <div style={styles.buttonRow}>
            <button style={styles.btnClean} onClick={() => addTrainingExample('clean')}>
             Train Undamaged ({trainingCounts.clean})
            </button>
            <button style={styles.btnDirty} onClick={() => addTrainingExample('dirty')}>
             Train Damaged ({trainingCounts.dirty})
            </button>
          </div>

          <div style={styles.buttonRow}>
            <button style={styles.btnClear} onClick={clearModel}>
              Clear Saved Model
            </button>
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
  buttonRow: { display: 'flex', gap: '10px', justifyContent: 'center' },
  btnClean: { padding: '12px 24px', backgroundColor: '#34c759', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' },
  btnDirty: { padding: '12px 24px', backgroundColor: '#ff3b30', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' },
  btnClear: { padding: '8px 16px', backgroundColor: '#8e8e93', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' },
  resultBox: { padding: '15px', backgroundColor: '#fff', borderRadius: '8px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', color: '#333' }
};