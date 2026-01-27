import type { OlympiaSoundConfig, SoundDef } from "./SoundTypes";
import soundConfig from "@/lib/olympia/olympia-sound-config.json";

export class SoundRegistry {
  private config: OlympiaSoundConfig;

  constructor() {
    this.config = soundConfig as OlympiaSoundConfig;
  }

  getSoundDef(soundKey: string): SoundDef | null {
    return this.config.sounds[soundKey] || null;
  }

  getFileName(soundKey: string): string | null {
    const def = this.getSoundDef(soundKey);
    return def?.file || null;
  }

  findKeyByFileName(fileName: string): string | null {
    const target = fileName.trim().toLowerCase();
    if (!target) return null;
    const entries = Object.entries(this.config.sounds) as Array<[string, SoundDef]>;
    for (const [key, def] of entries) {
      const defName = def.file?.trim().toLowerCase();
      if (defName === target) return key;
    }
    return null;
  }

  getUrl(soundKey: string): string | null {
    const fileName = this.getFileName(soundKey);
    if (!fileName) return null;

    const encoded = fileName.replace(/ /g, "%20");
    return `https://fbxrlpiigoviphaxmstd.supabase.co/storage/v1/object/public/olympia/Olympia%20Sound/${encoded}.mp3`;
  }

  getVolume(soundKey: string): number {
    const def = this.getSoundDef(soundKey);
    return def?.volume ?? this.config.meta.default.volume;
  }

  isLoop(soundKey: string): boolean {
    const def = this.getSoundDef(soundKey);
    return def?.loop ?? this.config.meta.default.loop;
  }

  shouldAutoStop(soundKey: string): boolean {
    const def = this.getSoundDef(soundKey);
    return def?.autoStopWhenOtherPlays ?? this.config.meta.default.autoStopWhenOtherPlays;
  }

  getAllSoundKeys(): string[] {
    return Object.keys(this.config.sounds);
  }

  exists(soundKey: string): boolean {
    return soundKey in this.config.sounds;
  }
}
