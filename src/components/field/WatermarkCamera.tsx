'use client';

import { useState, useEffect, useRef } from 'react';
import { X, RotateCcw, Check } from 'lucide-react';

interface GeoInfo {
  lat: number;
  lng: number;
  address?: string;
  timestamp: Date;
}

export interface CapturedPhoto {
  blob: Blob;
  dataUrl: string;
  lat?: number;
  lng?: number;
  timestamp: string;
}

interface WatermarkCameraProps {
  onClose: () => void;
  onPhotoTaken: (photo: CapturedPhoto) => void;
}

function formatLatLng(lat: number, lng: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(5)}° ${latDir}  ${Math.abs(lng).toFixed(5)}° ${lngDir}`;
}

function formatDateTime(d: Date): string {
  return d.toLocaleString('en-GB', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, timeZoneName: 'short',
  }).replace(',', '');
}

export default function WatermarkCamera({ onClose, onPhotoTaken }: WatermarkCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [mode, setMode] = useState<'capturing' | 'preview'>('capturing');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [pendingMeta, setPendingMeta] = useState<{ lat?: number; lng?: number; timestamp: string } | null>(null);
  const [geoInfo, setGeoInfo] = useState<GeoInfo | null>(null);
  const [geoStatus, setGeoStatus] = useState<'locating' | 'ok' | 'error'>('locating');
  const [camError, setCamError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Start camera
  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setIsLoading(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setCamError(err.name === 'NotAllowedError' ? 'Camera access denied. Allow camera in browser settings.' : `Camera error: ${err.message}`);
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // Get geolocation — try high-accuracy first, fall back to low-accuracy on timeout
  useEffect(() => {
    if (!navigator.geolocation) { setGeoStatus('error'); return; }

    async function applyPosition(pos: GeolocationPosition) {
      const { latitude: lat, longitude: lng } = pos.coords;
      const info: GeoInfo = { lat, lng, timestamp: new Date() };
      try {
        const r = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14`,
          { headers: { 'Accept-Language': 'en' }, signal: AbortSignal.timeout(5000) }
        );
        if (r.ok) {
          const data = await r.json();
          const a = data.address || {};
          const parts = [a.suburb || a.quarter || a.neighbourhood, a.city || a.town || a.village, a.country].filter(Boolean);
          info.address = parts.join(', ');
        }
      } catch { /* coords-only fallback */ }
      setGeoInfo(info);
      setGeoStatus('ok');
    }

    // First attempt: high accuracy (GPS chip), 15s timeout
    navigator.geolocation.getCurrentPosition(
      applyPosition,
      () => {
        // Fall back to network/cell location — faster, less accurate
        navigator.geolocation.getCurrentPosition(
          applyPosition,
          () => setGeoStatus('error'),
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  }, []);

  function drawWatermark(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, captureTime: Date, geo: GeoInfo | null) {
    const W = canvas.width;
    const H = canvas.height;
    const scale = Math.max(W, H) / 1200;
    const fontSize = Math.round(22 * scale);
    const lineHeight = Math.round(30 * scale);
    const padX = Math.round(20 * scale);
    const padY = Math.round(16 * scale);

    const lines: string[] = [];
    if (geo) {
      if (geo.address) lines.push(`\u{1F4CD} ${geo.address}`);
      lines.push(formatLatLng(geo.lat, geo.lng));
    } else {
      lines.push('GPS: unavailable');
    }
    lines.push(formatDateTime(captureTime));
    lines.push('Tarmeer Field Survey');

    ctx.font = `${fontSize}px -apple-system, "SF Pro Text", "Helvetica Neue", Arial, sans-serif`;
    const maxW = Math.max(...lines.map(l => ctx.measureText(l).width));
    const boxW = maxW + padX * 2;
    const boxH = lines.length * lineHeight + padY * 2;
    const boxX = padX;
    const boxY = H - boxH - padY;

    // Text shadow instead of background block
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = Math.round(10 * scale);
    ctx.shadowOffsetX = Math.round(1 * scale);
    ctx.shadowOffsetY = Math.round(1 * scale);

    lines.forEach((line, i) => {
      const isLast = i === lines.length - 1;
      ctx.font = isLast
        ? `${Math.round(fontSize * 0.85)}px -apple-system, "SF Pro Text", Arial, sans-serif`
        : `bold ${fontSize}px -apple-system, "SF Pro Text", Arial, sans-serif`;
      ctx.fillStyle = isLast ? 'rgba(255,255,255,0.75)' : '#ffffff';
      ctx.fillText(line, boxX + padX, boxY + padY + fontSize + i * lineHeight);
    });

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }

  function takePhoto() {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const captureTime = new Date();
    drawWatermark(canvas, ctx, captureTime, geoInfo);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      setPendingBlob(blob);
      setPendingMeta({
        lat: geoInfo?.lat,
        lng: geoInfo?.lng,
        timestamp: captureTime.toISOString(),
      });
      setPreviewUrl(dataUrl);
      setMode('preview');
      if (videoRef.current) videoRef.current.pause();
    }, 'image/jpeg', 0.92);
  }

  function retake() {
    setMode('capturing');
    setPreviewUrl(null);
    setPendingBlob(null);
    setPendingMeta(null);
    if (videoRef.current) videoRef.current.play();
  }

  function usePhoto() {
    if (!pendingBlob || !pendingMeta) return;
    onPhotoTaken({
      blob: pendingBlob,
      dataUrl: previewUrl!,
      lat: pendingMeta.lat,
      lng: pendingMeta.lng,
      timestamp: pendingMeta.timestamp,
    });
    onClose();
  }

  // Live watermark lines for the overlay
  const now = new Date();
  const liveLines: string[] = [];
  if (geoInfo) {
    if (geoInfo.address) liveLines.push(`\u{1F4CD} ${geoInfo.address}`);
    liveLines.push(formatLatLng(geoInfo.lat, geoInfo.lng));
  } else {
    liveLines.push(geoStatus === 'locating' ? 'Locating GPS…' : 'GPS unavailable');
  }
  liveLines.push(formatDateTime(now));
  liveLines.push('Tarmeer Field Survey');

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col" style={{ touchAction: 'none' }}>
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center"
      >
        <X className="w-5 h-5 text-white" />
      </button>

      {/* Viewfinder / Preview */}
      <div className="flex-1 relative overflow-hidden bg-black">
        {camError ? (
          <div className="absolute inset-0 flex items-center justify-center px-8">
            <p className="text-white/70 text-center text-sm">{camError}</p>
          </div>
        ) : mode === 'capturing' ? (
          <>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {/* Live watermark overlay — mirrors what will be burned in */}
            <div className="absolute bottom-4 left-4 max-w-[88vw] pointer-events-none select-none">
              {liveLines.map((line, i) => (
                <p
                  key={i}
                  className={`text-white leading-snug ${i === liveLines.length - 1 ? 'text-[11px] opacity-75 mt-0.5' : 'text-[13px] font-semibold'}`}
                  style={{ textShadow: '0 1px 6px rgba(0,0,0,0.9), 0 0 12px rgba(0,0,0,0.7)' }}
                >
                  {line}
                </p>
              ))}
            </div>
          </>
        ) : (
          /* Preview of taken photo */
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl!} alt="Captured photo" className="w-full h-full object-contain" />
        )}

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-black px-8 py-8 flex items-center justify-center gap-14 safe-area-bottom">
        {mode === 'capturing' ? (
          <button
            onClick={takePhoto}
            disabled={!!camError || isLoading}
            className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center active:scale-95 transition disabled:opacity-40"
          >
            <div className="w-14 h-14 rounded-full bg-white" />
          </button>
        ) : (
          <>
            <button onClick={retake} className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 rounded-full bg-white/15 flex items-center justify-center">
                <RotateCcw className="w-6 h-6 text-white" />
              </div>
              <span className="text-white/60 text-xs">Retake</span>
            </button>
            <button onClick={usePhoto} className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 rounded-full bg-green-500 flex items-center justify-center">
                <Check className="w-6 h-6 text-white" />
              </div>
              <span className="text-white/60 text-xs">Use Photo</span>
            </button>
          </>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
