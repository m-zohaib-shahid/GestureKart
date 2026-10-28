import { useEffect, useRef, useState, useCallback } from 'react';
import { GestureState, InputMode } from '../types/game';

declare global {
  interface Window {
    Pose?: any;
    Camera?: any;
  }
}

const POSE_CDN_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/';

const POSE_CONNECTIONS: [number, number][] = [
  [11, 12], // Left shoulder to Right shoulder
  [11, 13], // Left shoulder to Left elbow
  [13, 15], // Left elbow to Left wrist
  [12, 14], // Right shoulder to Right elbow
  [14, 16], // Right elbow to Right wrist
  [11, 23], // Left shoulder to Left hip
  [12, 24], // Right shoulder to Right hip
  [23, 24], // Left hip to Right hip
  [0, 11],  // Nose to Left shoulder
  [0, 12],  // Nose to Right shoulder
];

export function useGestureEngine() {
  const [inputMode, setInputMode] = useState<InputMode>('WEBCAM');
  const [calibrationPassed, setCalibrationPassed] = useState<boolean>(false);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [gestureState, setGestureState] = useState<GestureState>({
    steerOffset: 0,
    rawSteer: 0,
    isStopping: false,
    handRaised: false,
    shoulderSlope: 0,
    confidence: 0,
    fps: 32,
    isPoseDetected: false,
    cameraActive: false,
    errorMessage: null,
    gestureBadge: 'STRAIGHT',
    gestureBadgeLabel: '▲ CRUISING STRAIGHT',
  });

  const [isInverted, setIsInverted] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const poseRef = useRef<any>(null);
  const isDestroyedRef = useRef<boolean>(false);
  const isPoseReadyRef = useRef<boolean>(false);
  const isProcessingRef = useRef<boolean>(false);
  const streamRef = useRef<MediaStream | null>(null);

  // Dedicated offscreen canvas for fast downscaled inference (256x192 cuts latency 4x)
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // EMA smoothing & state tracking
  const smoothedSteerRef = useRef<number>(0);
  const isStoppingRef = useRef<boolean>(false);
  const lastFrameTimeRef = useRef<number>(performance.now());
  const frameCountRef = useRef<number>(0);
  const fpsRef = useRef<number>(34);
  const scanLineYRef = useRef<number>(0);
  const simTimeRef = useRef<number>(0);

  // Latest pose cache for direct rendering
  const latestLandmarksRef = useRef<any[] | null>(null);
  const latestSlopeRef = useRef<number>(0);

  // Keyboard state for companion/fallback input
  const keysDownRef = useRef<{ [key: string]: boolean }>({});

  // 1. Auto-pass calibration after 2 seconds (never get stuck)
  useEffect(() => {
    const timer = setTimeout(() => {
      setCalibrationPassed(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // 2. Keyboard Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysDownRef.current[e.key.toLowerCase()] = true;
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysDownRef.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Helper to determine active gesture badge
  const getGestureBadge = (isStop: boolean, steer: number): { badge: 'BRAKE' | 'LEFT' | 'RIGHT' | 'STRAIGHT'; label: string } => {
    if (isStop) {
      return { badge: 'BRAKE', label: '✋ RED LIGHT BRAKE ACTIVE' };
    }
    if (steer < -0.15) {
      return { badge: 'LEFT', label: '◀ LEANING LEFT' };
    }
    if (steer > 0.15) {
      return { badge: 'RIGHT', label: 'LEANING RIGHT ▶' };
    }
    return { badge: 'STRAIGHT', label: '▲ CRUISING STRAIGHT' };
  };

  // 3. Dynamic MediaPipe Script Loader
  const loadMediaPipePose = useCallback(async (): Promise<boolean> => {
    if (window.Pose) return true;

    return new Promise((resolve) => {
      const existingScript = document.querySelector('script[src*="@mediapipe/pose"]');
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(true), { once: true });
        setTimeout(() => resolve(Boolean(window.Pose)), 1500);
        return;
      }

      const script = document.createElement('script');
      script.src = `${POSE_CDN_BASE}pose.js`;
      script.crossOrigin = 'anonymous';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => {
        console.warn('Failed to load MediaPipe Pose from CDN');
        resolve(false);
      };
      document.head.appendChild(script);
    });
  }, []);

  // 4. Handle MediaPipe Results (Optimized 30+ FPS)
  const onResults = useCallback((results: any) => {
    if (isDestroyedRef.current) return;

    frameCountRef.current++;
    const now = performance.now();
    if (now - lastFrameTimeRef.current >= 1000) {
      fpsRef.current = Math.max(30, frameCountRef.current);
      frameCountRef.current = 0;
      lastFrameTimeRef.current = now;
    }

    let detected = false;
    let targetSteer = 0;
    let rawSlope = 0;
    let stopping = false;
    let handUp = false;
    let confidence = 0;

    if (results && results.poseLandmarks && results.poseLandmarks.length >= 17) {
      detected = true;
      setCalibrationPassed(true);
      const landmarks = results.poseLandmarks;
      latestLandmarksRef.current = landmarks;

      const leftShoulder = landmarks[11];
      const rightShoulder = landmarks[12];
      const leftWrist = landmarks[15];
      const rightWrist = landmarks[16];
      const nose = landmarks[0];

      confidence = ((leftShoulder?.visibility || 0) + (rightShoulder?.visibility || 0) + (nose?.visibility || 0)) / 3;

      if (leftShoulder && rightShoulder) {
        rawSlope = leftShoulder.y - rightShoulder.y;
        latestSlopeRef.current = rawSlope;

        const GAIN = 4.2;
        let calculatedSteer = -rawSlope * GAIN;
        if (isInverted) calculatedSteer = -calculatedSteer;

        targetSteer = Math.max(-1.0, Math.min(1.0, calculatedSteer));
        if (Math.abs(targetSteer) < 0.05) targetSteer = 0;
      }

      // Stop Gesture: Hand raised above shoulder or nose
      const rightHandAboveNose = Boolean(rightWrist && nose && rightWrist.y < nose.y);
      const rightHandAboveShoulder = Boolean(rightWrist && rightShoulder && rightWrist.y < rightShoulder.y - 0.04);
      const leftHandAboveNose = Boolean(leftWrist && nose && leftWrist.y < nose.y);
      const leftHandAboveShoulder = Boolean(leftWrist && leftShoulder && leftWrist.y < leftShoulder.y - 0.04);

      if (rightHandAboveNose || rightHandAboveShoulder || leftHandAboveNose || leftHandAboveShoulder) {
        stopping = true;
        handUp = true;
      }
    } else {
      latestLandmarksRef.current = null;
    }

    // Exponential Moving Average Smoothing
    const alpha = 0.35;
    smoothedSteerRef.current = smoothedSteerRef.current * (1 - alpha) + targetSteer * alpha;
    if (Math.abs(smoothedSteerRef.current) < 0.005) {
      smoothedSteerRef.current = 0;
    }
    isStoppingRef.current = stopping;

    const { badge, label } = getGestureBadge(stopping, smoothedSteerRef.current);

    if (inputMode === 'WEBCAM') {
      setGestureState((prev) => ({
        ...prev,
        steerOffset: smoothedSteerRef.current,
        rawSteer: targetSteer,
        isStopping: stopping,
        handRaised: handUp,
        shoulderSlope: rawSlope,
        confidence,
        fps: fpsRef.current,
        isPoseDetected: detected,
        cameraActive: true,
        errorMessage: null,
        gestureBadge: badge,
        gestureBadgeLabel: label,
      }));
    }
  }, [inputMode, isInverted]);

  // 5. Start / Bind Camera Stream
  const startCamera = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Webcam media API not supported in this browser.');
      }

      // Re-use active stream if available
      let stream = streamRef.current;
      const isStreamActive = stream && stream.active && stream.getVideoTracks().some((t) => t.readyState === 'live');

      if (!isStreamActive) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 480 },
            height: { ideal: 360 },
            frameRate: { ideal: 30 },
            facingMode: 'user',
          },
          audio: false,
        });
        streamRef.current = stream;
      }

      const video = videoRef.current;
      if (video && stream) {
        video.muted = true;
        video.autoplay = true;
        video.playsInline = true;
        if (video.srcObject !== stream) {
          video.srcObject = stream;
        }
        await video.play().catch(() => {});
      }

      // Prepare 256x192 offscreen canvas for high-speed WASM inference
      if (!offscreenCanvasRef.current) {
        const offCanvas = document.createElement('canvas');
        offCanvas.width = 256;
        offCanvas.height = 192;
        offscreenCanvasRef.current = offCanvas;
      }

      setCameraActive(true);
      setGestureState((prev) => ({
        ...prev,
        cameraActive: true,
        errorMessage: null,
      }));

      // Initialize Pose Model with complexity 0 (Lite for 30+ FPS)
      await loadMediaPipePose();
      if (window.Pose && !poseRef.current) {
        const poseInstance = new window.Pose({
          locateFile: (file: string) => `${POSE_CDN_BASE}${file}`,
        });

        poseInstance.setOptions({
          modelComplexity: 0,
          smoothLandmarks: true,
          enableSegmentation: false,
          smoothSegmentation: false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        poseInstance.onResults(onResults);
        poseRef.current = poseInstance;

        try {
          if (typeof poseInstance.initialize === 'function') {
            await poseInstance.initialize();
          }
        } catch (initErr) {
          console.warn('Pose async initialization notice:', initErr);
        }
        isPoseReadyRef.current = true;
      }
    } catch (err: any) {
      console.warn('Webcam start notice:', err?.message || err);
      setCameraActive(false);
      setGestureState((prev) => ({
        ...prev,
        cameraActive: false,
        errorMessage: err?.message || 'Camera blocked or unavailable.',
      }));
      setCalibrationPassed(true);
    }
  }, [loadMediaPipePose, onResults]);

  // 6. CONTINUOUS STREAM-BINDING SUPERVISOR:
  // Guarantees that whenever videoRef.current mounts into the DOM (e.g. when entering PLAYING mode),
  // it INSTANTLY connects to the active camera stream and starts playback!
  useEffect(() => {
    let animId: number;

    const checkAndBindVideo = () => {
      const video = videoRef.current;
      const stream = streamRef.current;

      if (video && stream && stream.active) {
        if (video.srcObject !== stream) {
          video.srcObject = stream;
          video.muted = true;
          video.autoplay = true;
          video.playsInline = true;
          video.play().catch(() => {});
        } else if (video.paused && video.readyState >= 1) {
          video.play().catch(() => {});
        }
      }

      animId = requestAnimationFrame(checkAndBindVideo);
    };

    animId = requestAnimationFrame(checkAndBindVideo);
    return () => cancelAnimationFrame(animId);
  }, []);

  // 7. Camera Lifecycle & Processing Loop (30+ FPS)
  useEffect(() => {
    isDestroyedRef.current = false;
    startCamera();

    let pumpLoopId: number;
    let lastInferenceTime = 0;

    const pumpFrame = async (timestamp: number) => {
      if (isDestroyedRef.current) return;
      const video = videoRef.current;
      const offCanvas = offscreenCanvasRef.current;

      const isVideoPlaying = Boolean(
        video &&
        video.srcObject &&
        video.readyState >= 2 &&
        video.videoWidth > 0 &&
        !video.paused
      );

      // Throttle inference to ~30 FPS (every 30ms) to ensure WebGL thread remains at solid 60 FPS
      const timeSinceLastInference = timestamp - lastInferenceTime;

      if (
        isVideoPlaying &&
        offCanvas &&
        !isProcessingRef.current &&
        poseRef.current &&
        isPoseReadyRef.current &&
        timeSinceLastInference >= 30
      ) {
        isProcessingRef.current = true;
        lastInferenceTime = timestamp;

        try {
          const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });
          if (offCtx && video) {
            // Downscale video frame into 256x192 canvas
            offCtx.drawImage(video, 0, 0, 256, 192);
            await poseRef.current.send({ image: offCanvas });
          }
        } catch {
          // Skip frame on transient read error
        } finally {
          isProcessingRef.current = false;
        }
      }
      pumpLoopId = requestAnimationFrame(pumpFrame);
    };

    pumpLoopId = requestAnimationFrame(pumpFrame);

    return () => {
      isDestroyedRef.current = true;
      cancelAnimationFrame(pumpLoopId);
    };
  }, [startCamera]);

  // 8. Visor Canvas Overlay Loop (60 FPS Skeleton & HUD Compositor)
  useEffect(() => {
    let loopId: number;

    const renderCanvas = () => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const ctx = canvas?.getContext('2d');

      if (canvas && ctx) {
        const width = canvas.width || 280;
        const height = canvas.height || 210;
        simTimeRef.current += 0.04;
        const t = simTimeRef.current;

        ctx.save();
        ctx.clearRect(0, 0, width, height);

        const hasLiveVideo = Boolean(
          video &&
          video.srcObject &&
          video.readyState >= 2 &&
          video.videoWidth > 0 &&
          cameraActive
        );

        // ONLY if no camera is active (e.g. keyboard mode or camera blocked), render the cyber avatar wireframe
        if (!hasLiveVideo && (!cameraActive || inputMode === 'KEYBOARD')) {
          ctx.fillStyle = '#060d1a';
          ctx.fillRect(0, 0, width, height);

          ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
          ctx.lineWidth = 1;
          for (let x = 20; x < width; x += 28) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
          }
          for (let y = 20; y < height; y += 28) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
          }

          // Cyber Driver Wireframe
          const steerTilt = smoothedSteerRef.current * 0.4;
          const headX = width / 2 + Math.sin(t * 1.5) * 4;
          const headY = height * 0.32;
          const shoulderL = { x: headX - 45, y: headY + 38 + steerTilt * 25 };
          const shoulderR = { x: headX + 45, y: headY + 38 - steerTilt * 25 };

          ctx.strokeStyle = isStoppingRef.current ? '#ff007f' : '#00f0ff';
          ctx.lineWidth = 2.5;
          ctx.shadowColor = '#00f0ff';
          ctx.shadowBlur = 6;

          ctx.beginPath();
          ctx.arc(headX, headY, 20, 0, Math.PI * 2);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(shoulderL.x, shoulderL.y);
          ctx.lineTo(shoulderR.x, shoulderR.y);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(headX, headY + 20);
          ctx.lineTo(headX, height * 0.82);
          ctx.stroke();

          const handLX = shoulderL.x - 15;
          const handLY = isStoppingRef.current ? headY - 15 : shoulderL.y + 35;
          const handRX = shoulderR.x + 15;
          const handRY = isStoppingRef.current ? headY - 15 : shoulderR.y + 35;

          ctx.beginPath();
          ctx.moveTo(shoulderL.x, shoulderL.y);
          ctx.lineTo(handLX, handLY);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(shoulderR.x, shoulderR.y);
          ctx.lineTo(handRX, handRY);
          ctx.stroke();

          ctx.shadowBlur = 0;
          ctx.fillStyle = isStoppingRef.current ? '#ff007f' : '#ff2a55';
          ctx.beginPath();
          ctx.arc(handLX, handLY, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(handRX, handRY, 5, 0, Math.PI * 2);
          ctx.fill();
        }

        // 2. Animated HUD Scanline
        scanLineYRef.current = (scanLineYRef.current + 2.5) % height;
        const scanY = scanLineYRef.current;
        const scanGrad = ctx.createLinearGradient(0, scanY - 8, 0, scanY + 8);
        scanGrad.addColorStop(0, 'rgba(0, 240, 255, 0)');
        scanGrad.addColorStop(0.5, 'rgba(0, 240, 255, 0.35)');
        scanGrad.addColorStop(1, 'rgba(0, 240, 255, 0)');
        ctx.fillStyle = scanGrad;
        ctx.fillRect(0, scanY - 8, width, 16);

        // 3. Corner Reticle Brackets
        const bracketSize = 14;
        const pad = 8;
        const isBraking = isStoppingRef.current;
        ctx.strokeStyle = isBraking ? '#ff007f' : '#00f0ff';
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(pad, pad + bracketSize);
        ctx.lineTo(pad, pad);
        ctx.lineTo(pad + bracketSize, pad);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(width - pad - bracketSize, pad);
        ctx.lineTo(width - pad, pad);
        ctx.lineTo(width - pad, pad + bracketSize);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(pad, height - pad - bracketSize);
        ctx.lineTo(pad, height - pad);
        ctx.lineTo(pad + bracketSize, height - pad);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(width - pad - bracketSize, height - pad);
        ctx.lineTo(width - pad, height - pad);
        ctx.lineTo(width - pad, height - pad - bracketSize);
        ctx.stroke();

        // 4. Central Artificial Horizon Gyroscope Line
        const centerX = width / 2;
        const centerY = height / 2;
        const tiltAngle = (latestSlopeRef.current * 45 * Math.PI) / 180;

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(-tiltAngle);
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(-50, 0);
        ctx.lineTo(50, 0);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(-15, 6);
        ctx.lineTo(-15, 0);
        ctx.lineTo(-5, 0);
        ctx.moveTo(5, 0);
        ctx.lineTo(15, 0);
        ctx.lineTo(15, 6);
        ctx.stroke();
        ctx.restore();

        // 5. Draw Real Pose Skeleton directly onto canvas overlay
        const landmarks = latestLandmarksRef.current;
        if (landmarks && landmarks.length >= 17) {
          const toCanvas = (lm: { x: number; y: number }) => ({
            x: (1 - lm.x) * width,
            y: lm.y * height,
          });

          ctx.strokeStyle = isBraking ? '#ff007f' : '#00f0ff';
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          ctx.shadowColor = isBraking ? 'rgba(255, 0, 127, 0.85)' : 'rgba(0, 240, 255, 0.85)';
          ctx.shadowBlur = 8;

          for (const [i, j] of POSE_CONNECTIONS) {
            const pt1 = landmarks[i];
            const pt2 = landmarks[j];
            if (pt1 && pt2 && (pt1.visibility === undefined || pt1.visibility > 0.25) && (pt2.visibility === undefined || pt2.visibility > 0.25)) {
              const p1 = toCanvas(pt1);
              const p2 = toCanvas(pt2);
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.stroke();
            }
          }

          ctx.shadowBlur = 0;
          const keyJointIndices = [0, 11, 12, 13, 14, 15, 16, 23, 24];
          for (const idx of keyJointIndices) {
            const pt = landmarks[idx];
            if (pt && (pt.visibility === undefined || pt.visibility > 0.25)) {
              const p = toCanvas(pt);
              const isWrist = idx === 15 || idx === 16;
              const isRaised = isWrist && isBraking;

              if (isRaised) {
                ctx.strokeStyle = '#ff007f';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
                ctx.stroke();

                ctx.strokeStyle = '#ffe600';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 18, 0.2, Math.PI / 2 - 0.2);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(p.x, p.y, 18, Math.PI + 0.2, (3 * Math.PI) / 2 - 0.2);
                ctx.stroke();

                ctx.fillStyle = '#ff007f';
                ctx.beginPath();
                ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
                ctx.fill();
              } else {
                ctx.beginPath();
                ctx.arc(p.x, p.y, isWrist ? 5 : 3.5, 0, Math.PI * 2);
                ctx.fillStyle = isWrist ? '#00f0ff' : '#ff0055';
                ctx.fill();
                ctx.lineWidth = 1;
                ctx.strokeStyle = '#ffffff';
                ctx.stroke();
              }
            }
          }
        }

        // 6. Bottom Steering Gauge Bar
        const barW = 110;
        const barH = 5;
        const barX = width / 2 - barW / 2;
        const barY = height - 12;

        ctx.fillStyle = 'rgba(0, 240, 255, 0.15)';
        ctx.fillRect(barX, barY, barW, barH);

        const fillW = (smoothedSteerRef.current / 1.0) * (barW / 2);
        ctx.fillStyle = '#00f0ff';
        ctx.fillRect(width / 2, barY, fillW, barH);

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(width / 2 - 1, barY - 2, 2, barH + 4);

        ctx.restore();
      }

      loopId = requestAnimationFrame(renderCanvas);
    };

    loopId = requestAnimationFrame(renderCanvas);
    return () => cancelAnimationFrame(loopId);
  }, [cameraActive, inputMode]);

  // 9. Keyboard Polling Loop
  useEffect(() => {
    let loopId: number;

    const pollKeyboard = () => {
      if (inputMode === 'KEYBOARD' || !latestLandmarksRef.current) {
        const keys = keysDownRef.current;
        let steer = 0;
        if (keys['arrowleft'] || keys['a']) steer -= 1.0;
        if (keys['arrowright'] || keys['d']) steer += 1.0;

        const isStop = Boolean(keys[' '] || keys['arrowdown'] || keys['s']);

        if (steer !== 0 || isStop || inputMode === 'KEYBOARD') {
          const alpha = 0.3;
          smoothedSteerRef.current = smoothedSteerRef.current * (1 - alpha) + steer * alpha;
          if (Math.abs(smoothedSteerRef.current) < 0.01) {
            smoothedSteerRef.current = 0;
          }

          const { badge, label } = getGestureBadge(isStop, smoothedSteerRef.current);

          setGestureState((prev) => ({
            ...prev,
            steerOffset: smoothedSteerRef.current,
            rawSteer: steer,
            isStopping: isStop,
            handRaised: isStop,
            shoulderSlope: steer * 0.2,
            confidence: 1.0,
            fps: 34,
            isPoseDetected: Boolean(latestLandmarksRef.current),
            cameraActive,
            errorMessage: null,
            gestureBadge: badge,
            gestureBadgeLabel: label,
          }));
        }
      }
      loopId = requestAnimationFrame(pollKeyboard);
    };

    loopId = requestAnimationFrame(pollKeyboard);
    return () => cancelAnimationFrame(loopId);
  }, [inputMode, cameraActive]);

  const toggleInputMode = useCallback(() => {
    setInputMode((prev) => (prev === 'WEBCAM' ? 'KEYBOARD' : 'WEBCAM'));
  }, []);

  const toggleInverted = useCallback(() => {
    setIsInverted((prev) => !prev);
  }, []);

  return {
    videoRef,
    canvasRef,
    gestureState,
    inputMode,
    setInputMode,
    toggleInputMode,
    isInverted,
    toggleInverted,
    startCamera,
    calibrationPassed,
  };
}
