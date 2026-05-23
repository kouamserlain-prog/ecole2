'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FiCamera, FiRefreshCw } from 'react-icons/fi';
import Button from '../ui/Button';
import { computeFaceDescriptorFromVideo, loadFaceApi } from '@/lib/faceApiLoader';

type FaceCaptureProps = {
  onDescriptor: (descriptor: number[]) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
  label?: string;
};

export default function FaceCapture({
  onDescriptor,
  onError,
  disabled = false,
  label = 'Capturer le visage',
}: FaceCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [modelsReady, setModelsReady] = useState(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setReady(true);
    } catch {
      onError?.('Impossible d’accéder à la caméra. Autorisez l’accès dans le navigateur.');
      setReady(false);
    }
  }, [onError, stopCamera]);

  useEffect(() => {
    void loadFaceApi()
      .then(() => setModelsReady(true))
      .catch(() => onError?.('Échec du chargement des modèles de reconnaissance faciale.'));
    return () => stopCamera();
  }, [onError, stopCamera]);

  const capture = async () => {
    if (!videoRef.current || !modelsReady) return;
    setLoading(true);
    try {
      const descriptor = await computeFaceDescriptorFromVideo(videoRef.current);
      if (!descriptor) {
        onError?.('Aucun visage détecté. Placez-vous face à la caméra, avec un bon éclairage.');
        return;
      }
      onDescriptor(Array.from(descriptor));
    } catch (e: unknown) {
      onError?.(e instanceof Error ? e.message : 'Erreur lors de la capture.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative aspect-video max-w-md overflow-hidden rounded-xl border border-stone-200 bg-stone-900">
        <video
          ref={videoRef}
          className="h-full w-full object-cover mirror"
          playsInline
          muted
          style={{ transform: 'scaleX(-1)' }}
        />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-stone-900/80 text-sm text-white">
            Caméra inactive
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => void startCamera()}>
          <FiCamera className="mr-1 h-4 w-4" />
          {ready ? 'Relancer la caméra' : 'Activer la caméra'}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={disabled || !ready || !modelsReady || loading}
          onClick={() => void capture()}
        >
          <FiRefreshCw className={`mr-1 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Analyse…' : label}
        </Button>
      </div>
      {!modelsReady && <p className="text-xs text-stone-500">Chargement des modèles IA…</p>}
    </div>
  );
}
