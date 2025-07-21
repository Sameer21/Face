"use client"; // This directive is necessary for client-side components in Next.js App Router

import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as faceapi from 'face-api.js';

export default function HomePage() {
  const [cameraOn, setCameraOn] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);

  const [isRecording, setIsRecording] = useState(false);
  const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null);
  const [loadingModels, setLoadingModels] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Function to load face-api.js models
  const loadModels = useCallback(async () => {
    // IMPORTANT: Ensure this path is correct.
    // The 'models' folder MUST be directly inside your 'public' directory.
    const MODEL_URL = '/models';
    try {
      setLoadingModels(true);
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL)
      ]);
      setLoadingModels(false);
      console.log("Face-API models loaded successfully!");
      setError(null); // Clear any previous errors
    } catch (err) {
      console.error("Error loading face-api models:", err);
      setError("Failed to load face tracking models. Please check your network and model paths. Ensure models are in public/models.");
      setLoadingModels(false);
    }
  }, []);

  // Function to start video stream and face detection
  useEffect(() => {
    const startVideo = async () => {
      if (!videoRef.current || !canvasRef.current) return;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          console.log("Video stream started.");
          // Only start face detection after models are loaded and video is playing
          if (!loadingModels && !error) {
            startFaceDetection();
          }
        };
      } catch (err) {
        console.error("Error accessing camera:", err);
        setError("Failed to access camera. Please ensure you have a webcam and grant permissions.");
      }
    };

    const startFaceDetection = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      const displaySize = { width: video.width, height: video.height };
      faceapi.matchDimensions(canvas, displaySize);

      // Clear previous intervals to prevent multiple detections running
      let detectionInterval: NodeJS.Timeout | null = null;
      if (detectionInterval) clearInterval(detectionInterval);

      detectionInterval = setInterval(async () => {
        if (!video.paused && !video.ended) {
          const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks(faceapi.TinyFaceDetectorOptions());
          const resizedDetections = faceapi.resizeResults(detections, displaySize);

          const context = canvas.getContext('2d');
          if (context) {
            context.clearRect(0, 0, canvas.width, canvas.height);
            faceapi.draw.drawDetections(canvas, resizedDetections);
            // Optionally draw landmarks if needed for more detailed markers
            // faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
          }
        }
      }, 100); // Detect faces every 100ms
    };

    loadModels();
    if (!loadingModels && !error && cameraOn) {
      startVideo();
    } else if (videoRef.current && videoRef.current.srcObject && !cameraOn) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    // Cleanup on component unmount
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
        console.log("Video stream stopped.");
      }
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
      }
      if (videoRef.current && videoRef.current.onloadedmetadata) {
        videoRef.current.onloadedmetadata = null;
      }
    };
  }, [loadModels, loadingModels, error, isRecording, cameraOn]);

  // Handle data available from MediaRecorder
  const handleDataAvailable = useCallback((event: BlobEvent) => {
    if (event.data.size > 0) {
      recordedChunks.current.push(event.data);
    }
  }, []);

  // Handle stop recording
  const handleStop = useCallback(() => {
    const superBuffer = new Blob(recordedChunks.current, {
      type: 'video/webm; codecs=vp8'
    });
    const url = URL.createObjectURL(superBuffer);
    setVideoBlobUrl(url);
    setIsRecording(false);
    recordedChunks.current = []; // Clear chunks for next recording

    // Save to localStorage
    const reader = new FileReader();
    reader.onloadend = () => {
      try {
        localStorage.setItem('recordedVideo', reader.result as string);
        console.log("Video saved to localStorage!");
      } catch (e) {
        console.error("Failed to save video to localStorage:", e);
        setError("Failed to save video to local storage. It might be too large.");
      }
    };
    reader.readAsDataURL(superBuffer);
  }, []);

  // Start recording
  const startRecording = useCallback(async () => {
    if (!videoRef.current || !videoRef.current.srcObject) {
      setError("No video stream available to record.");
      return;
    }

    recordedChunks.current = []; // Clear previous chunks
    setVideoBlobUrl(null); // Clear previous video URL

    try {
      const stream = videoRef.current.srcObject as MediaStream;
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'video/webm; codecs=vp8'
      });
      mediaRecorderRef.current.ondataavailable = handleDataAvailable;
      mediaRecorderRef.current.onstop = handleStop;
      mediaRecorderRef.current.start();
      setIsRecording(true);
      console.log("Recording started.");
    } catch (err) {
      console.error("Error starting MediaRecorder:", err);
      setError("Failed to start recording. Your browser might not support MediaRecorder API or the selected mimeType.");
    }
  }, [handleDataAvailable, handleStop]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      console.log("Recording stopped.");
    }
  }, [isRecording]);

  // Download video
  const downloadVideo = useCallback(() => {
    if (videoBlobUrl) {
      const a = document.createElement('a');
      a.href = videoBlobUrl;
      a.download = `face-tracking-video-${Date.now()}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      console.log("Video download initiated.");
    } else {
      setError("No video recorded to download.");
    }
  }, [videoBlobUrl]);

  // Load video from localStorage on mount
  useEffect(() => {
    const savedVideo = localStorage.getItem('recordedVideo');
    if (savedVideo) {
      setVideoBlobUrl(savedVideo);
      console.log("Loaded video from localStorage.");
    }
  }, []);

  return (
    <div className="container min-h-screen flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold mb-6 text-center text-blue-700">Face Tracking & Video Recorder</h1>

      {loadingModels && (
        <p className="text-lg text-gray-600 mb-4">Loading face tracking models... This might take a moment.</p>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <strong className="font-bold">Error:</strong>
          <span className="block sm:inline"> {error}</span>
        </div>
      )}

      <div className="video-container relative w-full max-w-2xl bg-gray-900 rounded-lg shadow-xl overflow-hidden">
        {cameraOn && (
          <>
            <video
              ref={videoRef}
              width="640"
              height="480"
              autoPlay
              muted
              className="w-full h-auto rounded-lg"
              style={{ transform: 'scaleX(-1)' }}
            ></video>
            <canvas
              ref={canvasRef}
              width="640"
              height="480"
              className="absolute top-0 left-0 w-full h-full"
              style={{ transform: 'scaleX(-1)' }}
            ></canvas>
          </>
        )}
      </div>

      <div className="controls mt-6 flex flex-wrap justify-center gap-4">
        <button
          onClick={startRecording}
          disabled={isRecording || loadingModels || !!error || !cameraOn}
          className={`px-6 py-3 rounded-full text-white font-semibold transition-all duration-300 ease-in-out
            ${isRecording || loadingModels || !!error || !cameraOn ? 'bg-red-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 shadow-lg'}`}
        >
          {isRecording ? 'Recording...' : 'Start Recording'}
        </button>
        <button
          onClick={stopRecording}
          disabled={!isRecording}
          className={`px-6 py-3 rounded-full text-white font-semibold transition-all duration-300 ease-in-out
            ${!isRecording ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 shadow-lg'}`}
        >
          Stop Recording
        </button>
        <button
          onClick={downloadVideo}
          disabled={!videoBlobUrl || isRecording}
          className={`px-6 py-3 rounded-full text-white font-semibold transition-all duration-300 ease-in-out
            ${!videoBlobUrl || isRecording ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-lg'}`}
        >
          Download Video
        </button>
        <button
          onClick={() => setCameraOn((prev) => !prev)}
          className={`px-6 py-3 rounded-full text-white font-semibold transition-all duration-300 ease-in-out ${cameraOn ? 'bg-yellow-600 hover:bg-yellow-700 shadow-lg' : 'bg-gray-600 hover:bg-gray-700 shadow-lg'}`}
        >
          {cameraOn ? 'Close Camera' : 'Open Camera'}
        </button>
      </div>

      {videoBlobUrl && (
        <div className="recorded-video-section mt-8 w-full max-w-2xl">
          <h2 className="text-2xl font-bold mb-4 text-center text-blue-700">Recorded Video</h2>
          <video
            src={videoBlobUrl}
            controls
            className="w-full h-auto rounded-lg shadow-xl"
          ></video>
        </div>
      )}
    </div>
  );
}
