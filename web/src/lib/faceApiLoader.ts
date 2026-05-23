/** Chargement unique des modèles face-api (navigateur uniquement). */
const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model';

let loadPromise: Promise<typeof import('@vladmandic/face-api')> | null = null;

export async function loadFaceApi() {
  if (typeof window === 'undefined') {
    throw new Error('La reconnaissance faciale nécessite un navigateur.');
  }
  if (!loadPromise) {
    loadPromise = (async () => {
      const faceapi = await import('@vladmandic/face-api');
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      return faceapi;
    })();
  }
  return loadPromise;
}

export async function computeFaceDescriptorFromVideo(
  video: HTMLVideoElement,
): Promise<Float32Array | null> {
  const faceapi = await loadFaceApi();
  const detection = await faceapi
    .detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor();
  return detection?.descriptor ?? null;
}

export function descriptorToArray(descriptor: Float32Array): number[] {
  return Array.from(descriptor);
}
