import type { PlayOptions, PlayResult, SoundState, SoundGroup } from "./SoundTypes";
import { SOUND_GROUPS } from "./SoundTypes";
import { SoundRegistry } from "./SoundRegistry";
import { SoundCacheManager } from "./SoundCacheManager";

export class SoundController {
  private playbackState = new Map<string, SoundState>();
  private playQueue: Array<{ soundKey: string; options?: PlayOptions }> = [];
  private isProcessingQueue = false;
  private cacheManager: SoundCacheManager;
  private registry: SoundRegistry;

  constructor(cacheManager: SoundCacheManager, registry: SoundRegistry) {
    this.cacheManager = cacheManager;
    this.registry = registry;
  }

  async play(soundKey: string, options?: PlayOptions): Promise<PlayResult> {
    if (!this.registry.exists(soundKey)) {
      console.warn(`[Sound] Sound "${soundKey}" not found in config`);
      return { success: false, error: "Sound not found" };
    }

    if (!this.cacheManager.isReady(soundKey)) {
      console.warn(`[Sound] Sound "${soundKey}" not cached`);
      return { success: false, error: "Sound not cached" };
    }

    const audioContext = this.cacheManager.getAudioContext();
    if (!audioContext) {
      console.warn("[Sound] No AudioContext");
      return { success: false, error: "No AudioContext" };
    }

    if (audioContext.state === "suspended") {
      console.warn("[Sound] AudioContext suspended, resuming...");
      await audioContext.resume();
    }

    // Apply override rules
    const mustStop = this.getOverrideStops(soundKey);
    for (const stopKey of mustStop) {
      this.stop(stopKey);
    }

    // Apply delay if specified
    if (options?.delay) {
      await new Promise((resolve) => setTimeout(resolve, options.delay));
    }

    try {
      const buffer = this.cacheManager.getAudioBuffer(soundKey);
      if (!buffer) {
        return { success: false, error: "Buffer not available" };
      }

      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.loop = this.registry.isLoop(soundKey);

      const gainNode = audioContext.createGain();
      gainNode.gain.value = this.registry.getVolume(soundKey);

      source.connect(gainNode);
      gainNode.connect(audioContext.destination);

      source.onended = () => {
        this.playbackState.delete(soundKey);
        if (options?.onEnd) {
          options.onEnd();
        }
      };

      source.start(0);

      this.playbackState.set(soundKey, {
        state: "playing",
        sourceNode: source,
        gainNode: gainNode,
        startTime: audioContext.currentTime,
      });

      console.log(`[Sound] Playing: ${soundKey}`);
      return { success: true };
    } catch (error) {
      console.error(`[Sound] Play failed for ${soundKey}:`, error);
      return { success: false, error: String(error) };
    }
  }

  stop(soundKey: string): void {
    const state = this.playbackState.get(soundKey);
    if (!state || state.state === "stopped") {
      return;
    }

    try {
      if (state.sourceNode) {
        state.sourceNode.stop(0);
      }
      this.playbackState.delete(soundKey);
      console.log(`[Sound] Stopped: ${soundKey}`);
    } catch (error) {
      console.warn(`[Sound] Error stopping ${soundKey}:`, error);
    }
  }

  stopGroup(groupName: SoundGroup): void {
    const soundKeys = SOUND_GROUPS[groupName] || [];
    for (const soundKey of soundKeys) {
      this.stop(soundKey);
    }
  }

  stopAll(): void {
    const keys = Array.from(this.playbackState.keys());
    for (const soundKey of keys) {
      this.stop(soundKey);
    }
  }

  pause(soundKey: string): void {
    const state = this.playbackState.get(soundKey);
    if (!state || state.state !== "playing") {
      return;
    }

    try {
      if (state.sourceNode && state.sourceNode.stop) {
        state.sourceNode.stop(0);
      }
      state.state = "paused";
      console.log(`[Sound] Paused: ${soundKey}`);
    } catch (error) {
      console.warn(`[Sound] Error pausing ${soundKey}:`, error);
    }
  }

  isPlaying(soundKey: string): boolean {
    const state = this.playbackState.get(soundKey);
    return state?.state === "playing";
  }

  getPlayingKeys(): string[] {
    return Array.from(this.playbackState.entries())
      .filter(([, state]) => state.state === "playing")
      .map(([key]) => key);
  }

  isReady(soundKey: string): boolean {
    return this.cacheManager.isReady(soundKey);
  }

  isMissing(soundKey: string): boolean {
    return this.cacheManager.isMissing(soundKey);
  }

  setVolume(soundKey: string, volume: number): void {
    const state = this.playbackState.get(soundKey);
    if (state?.gainNode) {
      state.gainNode.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  private getOverrideStops(soundKeyToPlay: string): string[] {
    const mustStop: string[] = [];

    // Star sound (vd_ngoi_sao) stops everything
    if (soundKeyToPlay === "vd_ngoi_sao") {
      return Array.from(this.playbackState.keys()).filter((k) => this.isPlaying(k));
    }

    // Auto-stop sounds (autoStopWhenOtherPlays=true)
    if (this.registry.shouldAutoStop(soundKeyToPlay)) {
      const allKeys = this.registry.getAllSoundKeys();
      for (const key of allKeys) {
        if (this.isPlaying(key) && !SOUND_GROUPS.BACKGROUND.includes(key)) {
          mustStop.push(key);
        }
      }
    }

    // Timer override: correct/wrong answer stops timers
    const scoringSounds = SOUND_GROUPS.SCORING;
    if (scoringSounds.includes(soundKeyToPlay)) {
      const timerSounds = SOUND_GROUPS.COUNTDOWN;
      for (const timer of timerSounds) {
        if (this.isPlaying(timer)) {
          mustStop.push(timer);
        }
      }
    }

    return [...new Set(mustStop)];
  }
}
