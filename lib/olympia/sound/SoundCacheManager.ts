import type { CacheStatus, PreloadBatchResult } from "./SoundTypes";
import { SoundRegistry } from "./SoundRegistry";

const PRELOAD_BATCH_SIZE = 5;
const PRELOAD_TIMEOUT_MS = 10000;
const PRELOAD_MAX_RETRIES = 2;

export class SoundCacheManager {
  private cache = new Map<string, AudioBuffer>();
  private loadingPromises = new Map<string, Promise<AudioBuffer | null>>();
  private failedSounds = new Set<string>();
  private audioContext: AudioContext | null = null;
  private registry: SoundRegistry;

  constructor(registry: SoundRegistry) {
    this.registry = registry;
    this.initAudioContext();
  }

  private initAudioContext(): void {
    if (typeof window !== "undefined" && !this.audioContext) {
      const AudioCtx =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.audioContext = new AudioCtx();
      }
    }
  }

  async preloadAllSounds(): Promise<PreloadBatchResult> {
    if (!this.audioContext) {
      console.warn("[Sound] AudioContext not initialized");
      return { loaded: [], failed: [] };
    }

    const allKeys = this.registry.getAllSoundKeys();
    return this.preloadSounds(allKeys);
  }

  async preloadSounds(soundKeys: string[]): Promise<PreloadBatchResult> {
    const loaded: string[] = [];
    const failed: string[] = [];

    for (let i = 0; i < soundKeys.length; i += PRELOAD_BATCH_SIZE) {
      const batch = soundKeys.slice(i, i + PRELOAD_BATCH_SIZE);
      const results = await Promise.all(batch.map((key) => this.preloadSound(key)));

      results.forEach((success, idx) => {
        if (success) {
          loaded.push(batch[idx]);
        } else {
          failed.push(batch[idx]);
        }
      });
    }

    console.log(`[Sound] Preload: ${loaded.length} loaded, ${failed.length} failed`);
    return { loaded, failed };
  }

  private preloadSound(soundKey: string): Promise<boolean> {
    if (this.cache.has(soundKey)) {
      return Promise.resolve(true);
    }

    if (this.failedSounds.has(soundKey)) {
      return Promise.resolve(false);
    }

    if (this.loadingPromises.has(soundKey)) {
      return this.loadingPromises.get(soundKey)!.then((buf) => buf !== null);
    }

    const promise = this.fetchAndDecode(soundKey).then((buffer) => {
      if (buffer) {
        this.cache.set(soundKey, buffer);
        this.loadingPromises.delete(soundKey);
        return true;
      } else {
        this.failedSounds.add(soundKey);
        this.loadingPromises.delete(soundKey);
        return false;
      }
    });

    this.loadingPromises.set(
      soundKey,
      promise.then((success) => (success ? this.cache.get(soundKey) || null : null))
    );
    return promise;
  }

  private async fetchAndDecode(soundKey: string): Promise<AudioBuffer | null> {
    const url = this.registry.getUrl(soundKey);
    if (!url) {
      console.warn(`[Sound] No URL for ${soundKey}`);
      return null;
    }

    if (!this.audioContext) {
      console.warn("[Sound] No AudioContext");
      return null;
    }

    for (let attempt = 0; attempt <= PRELOAD_MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), PRELOAD_TIMEOUT_MS);

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

        if (!response.ok) {
          console.warn(`[Sound] Fetch failed for ${soundKey}: ${response.status}`);
          continue;
        }

        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
        return audioBuffer;
      } catch (error) {
        console.warn(`[Sound] Preload attempt ${attempt + 1} failed for ${soundKey}:`, error);
        if (attempt < PRELOAD_MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, 100));
        }
      }
    }

    return null;
  }

  isReady(soundKey: string): boolean {
    return this.cache.has(soundKey);
  }

  getAudioBuffer(soundKey: string): AudioBuffer | null {
    return this.cache.get(soundKey) || null;
  }

  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  isMissing(soundKey: string): boolean {
    return this.failedSounds.has(soundKey);
  }

  getStatus(): CacheStatus {
    const allKeys = this.registry.getAllSoundKeys();
    return {
      loaded: allKeys.filter((k) => this.cache.has(k)),
      failed: Array.from(this.failedSounds),
      pending: allKeys.filter((k) => !this.cache.has(k) && !this.failedSounds.has(k)),
    };
  }

  clear(): void {
    this.cache.clear();
    this.failedSounds.clear();
    this.loadingPromises.clear();
  }
}
