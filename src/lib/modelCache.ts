export const KARAOKE_MODEL_URL = 'https://huggingface.co/Blane187/all_public_uvr_models/resolve/main/UVR-MDX-NET-Inst_HQ_3.onnx';
export const VOCAL_MODEL_URL = 'https://huggingface.co/Blane187/all_public_uvr_models/resolve/main/Kim_Vocal_2.onnx';
export const MODEL_CACHE_NAME = 'web-demix2-models';
const MIN_MODEL_BYTES = 40 * 1024 * 1024;

export interface ModelDownloadProgress {
  loaded: number;
  total: number;
  cached: boolean;
}

export interface LocalModelHandle {
  url: string;
  release: () => void;
}

function validSize(value: number) {
  return Number.isFinite(value) && value >= MIN_MODEL_BYTES;
}

async function ensureModel(
  modelUrl: string,
  onProgress: (progress: ModelDownloadProgress) => void,
  signal?: AbortSignal,
): Promise<LocalModelHandle> {
  if (!('caches' in globalThis)) {
    throw new Error('Cache Storage is unavailable. Leave private browsing and retry so the local model can be stored.');
  }

  const cache = await caches.open(MODEL_CACHE_NAME);
  const cached = await cache.match(modelUrl);
  if (cached) {
    const size = Number(cached.headers.get('content-length'));
    if (validSize(size)) {
      onProgress({ loaded: size, total: size, cached: true });
      const objectUrl = URL.createObjectURL(await cached.blob());
      return { url: objectUrl, release: () => URL.revokeObjectURL(objectUrl) };
    }
    await cache.delete(modelUrl);
  }

  const response = await fetch(modelUrl, {
    mode: 'cors',
    cache: 'no-store',
    credentials: 'omit',
    redirect: 'follow',
    signal,
  });
  if (!response.ok || !response.body) {
    throw new Error(`Model download failed (${response.status} ${response.statusText || 'network response'}).`);
  }

  const declaredTotal = Number(response.headers.get('content-length'));
  const cacheResponse = response.clone();
  const headers = new Headers(cacheResponse.headers);
  headers.set('content-type', 'application/octet-stream');
  headers.set('x-openkaraoke-model-source', 'Blane187/all_public_uvr_models');
  let cacheWriteError: unknown;
  const cacheWrite = Promise.resolve(cache.put(modelUrl, new Response(cacheResponse.body, { status: 200, headers })))
    .catch((error: unknown) => { cacheWriteError = error; });
  const reader = response.body.getReader();
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      loaded += value.byteLength;
      onProgress({ loaded, total: validSize(declaredTotal) ? declaredTotal : 66_759_214, cached: false });
    }
  }
  await cacheWrite;
  if (!validSize(loaded) || (validSize(declaredTotal) && loaded !== declaredTotal)) {
    await cache.delete(modelUrl);
    throw new Error(`Model download was incomplete (${(loaded / 1024 / 1024).toFixed(1)} MB received).`);
  }
  if (cacheWriteError) throw new Error(`The model downloaded but could not be cached. ${cacheWriteError instanceof Error ? cacheWriteError.message : ''}`.trim());
  await navigator.storage?.persist?.().catch(() => false);
  onProgress({ loaded, total: loaded, cached: false });
  const stored = await cache.match(modelUrl);
  if (!stored) throw new Error('The model downloaded but could not be opened from local storage.');
  const objectUrl = URL.createObjectURL(await stored.blob());
  return { url: objectUrl, release: () => URL.revokeObjectURL(objectUrl) };
}

export function ensureKaraokeModel(onProgress: (progress: ModelDownloadProgress) => void, signal?: AbortSignal) {
  return ensureModel(KARAOKE_MODEL_URL, onProgress, signal);
}

export function ensureVocalModel(onProgress: (progress: ModelDownloadProgress) => void, signal?: AbortSignal) {
  return ensureModel(VOCAL_MODEL_URL, onProgress, signal);
}
