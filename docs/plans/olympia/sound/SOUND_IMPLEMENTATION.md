# Sound System - Implementation File Structure

**Hướng dẫn:** Đây là danh sách các file cần tạo theo đúng vị trí trong dự án.

---

## I. File Structure (Proposed)

```
lib/olympia/
├── olympia-sound-config.json          [EXISTING - READ ONLY]
│
├── sound/                              [NEW FOLDER]
│   ├── index.ts                        [Exports]
│   ├── soundController.ts              [Main class]
│   ├── soundCacheManager.ts            [Cache management]
│   ├── playbackStateManager.ts         [State tracking]
│   ├── overrideRulesEngine.ts          [Rules logic]
│   ├── soundEventDispatcher.ts         [Event handling]
│   ├── types.ts                        [TypeScript types & interfaces]
│   └── constants.ts                    [Timing, limits, etc.]
│
├── olympia-sound-url.ts                [URL builder helper]
│
└── olympia-sound-constants.ts          [Config constants]

hooks/
├── olympia/                            [NEW FOLDER]
│   ├── useSound.ts                     [React hook for sound]
│   └── useSoundEventDispatcher.ts      [Hook for dispatcher]

docs/olympia/
├── SOUND_ARCHITECTURE.md               [CREATED]
└── SOUND_QUICK_REFERENCE.md            [CREATED]
```

---

## II. File Descriptions & Dependencies

### `lib/olympia/sound/types.ts`
**Mục đích:** Define TypeScript types & interfaces

**Dependencies:** None

**Exports:**
```typescript
// Sound Config types
interface OlympiaSoundDef
interface OlympiaSoundConfig

// Playback state
interface PlaybackState
enum PlaybackStateType { PLAYING, PAUSED, STOPPED }

// Cache manager
interface ICacheStatus
interface ISoundCacheManager

// Playback state manager
interface IPlaybackStateManager

// Override rules
interface OverrideRule
enum RulePriority { NORMAL, HIGH, CRITICAL, MAXIMUM }

// Controller options
interface PlayOptions
interface PlayResult

// Event dispatcher
interface GameEventPayload
interface ISoundEventDispatcher

// Error handling
interface SoundError
```

---

### `lib/olympia/sound/constants.ts`
**Mục đích:** Timing, batch size, resource limits

**Dependencies:** None

**Exports:**
```typescript
export const SOUND_PRELOAD_CONFIG = {
  BATCH_SIZE: 5,
  TIMEOUT_MS: 10000,
  RETRY_COUNT: 2,
  MAX_CACHE_SIZE_MB: 100
}

export const SOUND_TIMING = {
  ROUND_START_DELAY_MS: 3000,
  CORRECT_ANSWER_WAIT_MS: 2000,
  WRONG_ANSWER_WAIT_MS: 2000,
  REVEAL_ANSWER_OVERLAP_MS: 1000
}

export const SOUND_GROUPS = {
  BACKGROUND: ["kd_bat_dau_choi", ...],
  COUNTDOWN: ["kd_dem_gio_5s", ...],
  SCORING: ["kd_dung", ...],
  // ...
}

export const PRIORITY = {
  NORMAL: 0,
  HIGH: 50,
  CRITICAL: 100,
  MAXIMUM: 999
}
```

---

### `lib/olympia/sound/soundCacheManager.ts`
**Mục đích:** Preload & manage sound cache

**Dependencies:**
- types.ts
- constants.ts
- olympia-sound-url.ts

**Key Methods:**
```typescript
class SoundCacheManager implements ISoundCacheManager {
  private cache: Map<string, AudioBuffer>
  private loadingPromises: Map<string, Promise<AudioBuffer>>
  private failedSounds: Set<string>
  private audioContext: AudioContext
  
  constructor(config: OlympiaSoundConfig)
  
  async preloadSound(soundKey: string): Promise<void>
  async preloadSounds(soundKeys: string[]): Promise<Result>
  isReady(soundKey: string): boolean
  getAudioBuffer(soundKey: string): AudioBuffer | null
  clearSound(soundKey: string): void
  clearAll(): void
  getStatus(): CacheStatus
}
```

---

### `lib/olympia/sound/playbackStateManager.ts`
**Mục đích:** Track playback state of each sound

**Dependencies:**
- types.ts

**Key Methods:**
```typescript
class PlaybackStateManager implements IPlaybackStateManager {
  private states: Map<string, PlaybackState>
  
  setPlaying(soundKey: string, sourceNode: AudioBufferSourceNode): void
  setPaused(soundKey: string): void
  setStopped(soundKey: string): void
  getState(soundKey: string): PlaybackState | null
  getPlayingKeys(): string[]
  isPlaying(soundKey: string): boolean
  clearAll(): void
}
```

---

### `lib/olympia/sound/overrideRulesEngine.ts`
**Mục đích:** Determine which sounds must stop when playing new sound

**Dependencies:**
- types.ts
- constants.ts
- olympia-sound-config.json (import)

**Key Methods:**
```typescript
class OverrideRulesEngine {
  private rules: Map<string, OverrideRule>
  private soundGroups: Map<string, string[]>
  
  constructor(config: OlympiaSoundConfig)
  
  getSoundsThatMustStop(soundKeyToPlay: string): string[]
  canOverride(soundToPlay: string, currentlyPlaying: string): boolean
  getPriority(soundKey: string): number
  getSoundGroup(groupName: string): string[]
}
```

---

### `lib/olympia/sound/soundController.ts`
**Mục đích:** Main API for playing/stopping sounds

**Dependencies:**
- types.ts
- soundCacheManager.ts
- playbackStateManager.ts
- overrideRulesEngine.ts
- olympia-sound-url.ts
- constants.ts

**Key Methods:**
```typescript
class SoundController {
  private cache: SoundCacheManager
  private playbackState: PlaybackStateManager
  private overrideRules: OverrideRulesEngine
  private audioContext: AudioContext
  
  async play(soundKey: string, options?: PlayOptions): Promise<PlayResult>
  stop(soundKey: string): void
  stopGroup(groupName: string): void
  stopAll(): void
  pause(soundKey: string): void
  resume(soundKey: string): void
  setVolume(soundKey: string, volume: number): void
  getState(soundKey: string): PlaybackState | null
  isCached(soundKey: string): boolean
}
```

---

### `lib/olympia/sound/soundEventDispatcher.ts`
**Mục đích:** Listen to game events & trigger sounds

**Dependencies:**
- types.ts
- soundController.ts
- constants.ts

**Key Methods:**
```typescript
class SoundEventDispatcher {
  private soundController: SoundController
  private eventBus: EventBus
  
  initialize(eventBus: EventBus): void
  destroy(): void
  
  private handleGameEvent(event: GameEvent): Promise<void>
  private handleRoundStarted(payload): Promise<void>
  private handleQuestionRevealed(payload): Promise<void>
  private handleTimerStarted(payload): Promise<void>
  private handleCorrectAnswer(payload): Promise<void>
  private handleWrongAnswer(payload): Promise<void>
  private handleTimerEnded(payload): Promise<void>
  private handleRoundEnded(payload): Promise<void>
  private handleStarRevealed(payload): Promise<void>
  private handleSessionEnded(payload): Promise<void>
}
```

---

### `lib/olympia/sound/index.ts`
**Mục đích:** Barrel export

**Exports:**
```typescript
export { SoundCacheManager } from "./soundCacheManager"
export { PlaybackStateManager } from "./playbackStateManager"
export { OverrideRulesEngine } from "./overrideRulesEngine"
export { SoundController } from "./soundController"
export { SoundEventDispatcher } from "./soundEventDispatcher"

export type {
  ISoundCacheManager,
  IPlaybackStateManager,
  PlaybackState,
  OverrideRule,
  PlayOptions,
  PlayResult
} from "./types"

export { SOUND_PRELOAD_CONFIG, SOUND_TIMING, SOUND_GROUPS } from "./constants"
```

---

### `lib/olympia/olympia-sound-url.ts`
**Mục đích:** URL builder & helper functions

**Dependencies:** None

**Exports:**
```typescript
function buildSoundUrl(fileName: string): string
function getSoundFileName(soundKey: string): string | null
function getSoundUrl(soundKey: string): string | null

// Validation
function isValidSoundFileName(fileName: string): boolean
function normalizeSoundFileName(fileName: string): string
```

---

### `lib/olympia/olympia-sound-constants.ts`
**Mục đích:** Global constants (preload, timing, etc.)

**Dependencies:** None

**Exports:**
```typescript
export const OLYMPIA_SOUND_CONFIG = {
  PRELOAD_BATCH_SIZE: 5,
  PRELOAD_TIMEOUT_MS: 10000,
  // ... rest
}

export const SUPABASE_SOUND_CONFIG = {
  BUCKET: "olympia",
  FOLDER: "Olympia Sound",
  BASE_URL: "https://fbxrlpiigoviphaxmstd.supabase.co/storage/v1/object/public"
}
```

---

### `hooks/olympia/useSound.ts`
**Mục đích:** React hook to use SoundController

**Dependencies:**
- lib/olympia/sound

**Exports:**
```typescript
function useSound(): {
  soundController: SoundController,
  isInitialized: boolean,
  cacheStatus: CacheStatus
}

// Usage in component:
const { soundController, isInitialized } = useSound()
await soundController.play("kd_bat_dau_choi")
```

---

### `hooks/olympia/useSoundEventDispatcher.ts`
**Mục đích:** React hook to setup event listener

**Dependencies:**
- lib/olympia/sound

**Exports:**
```typescript
function useSoundEventDispatcher(eventBus: EventBus): void

// Automatically:
// - Initialize dispatcher on mount
// - Subscribe to events
// - Cleanup on unmount
```

---

## III. Integration Points (Where to import/use)

### In `components/olympia/shared/game/useOlympiaGameState.ts`
```typescript
import { useSoundEventDispatcher } from '@/hooks/olympia/useSoundEventDispatcher'

function useOlympiaGameState() {
  // ... existing code ...
  
  // Add sound event dispatcher
  useSoundEventDispatcher(gameEventBus)
  
  // ... rest ...
}
```

### In Round Components (Example: KhoiDongRound.tsx)
```typescript
import { useSound } from '@/hooks/olympia/useSound'

function KhoiDongRound({ roundId }) {
  const { soundController } = useSound()
  
  const handleCorrectAnswer = async () => {
    // Stop timer
    soundController.stop("kd_dem_gio_5s")
    // Play correct sound
    await soundController.play("kd_dung", {
      onEnd: () => handleRoundEnd()
    })
  }
  
  return (
    // JSX...
  )
}
```

### In Admin Event Listener (HostRealtimeEventsListener.tsx)
```typescript
import { useSoundEventDispatcher } from '@/hooks/olympia/useSoundEventDispatcher'

function HostRealtimeEventsListener() {
  // ... existing code ...
  
  // Sound dispatcher will auto-handle events
  useSoundEventDispatcher(gameEventBus)
  
  // ... rest ...
}
```

---

## IV. Type Imports Pattern

```typescript
// ✅ DO: Separate imports
import type { 
  ISoundCacheManager, 
  PlaybackState,
  PlayOptions 
} from '@/lib/olympia/sound'
import { SoundController } from '@/lib/olympia/sound'

// ❌ DON'T: Mix or use wildcard
import * as SoundSystem from '@/lib/olympia/sound'
import { SoundController, type PlayOptions } from '@/lib/olympia/sound' // Mixed
```

---

## V. File Creation Order (Recommended)

### Step 1: Foundation
1. `lib/olympia/sound/types.ts`
2. `lib/olympia/sound/constants.ts`
3. `lib/olympia/olympia-sound-url.ts`

### Step 2: Core Managers
4. `lib/olympia/sound/soundCacheManager.ts`
5. `lib/olympia/sound/playbackStateManager.ts`
6. `lib/olympia/sound/overrideRulesEngine.ts`

### Step 3: Main Controller
7. `lib/olympia/sound/soundController.ts`

### Step 4: Event & Hooks
8. `lib/olympia/sound/soundEventDispatcher.ts`
9. `lib/olympia/sound/index.ts`
10. `hooks/olympia/useSound.ts`
11. `hooks/olympia/useSoundEventDispatcher.ts`

### Step 5: Integration & Testing
12. Integrate into `useOlympiaGameState.ts`
13. Add to round components (as needed)
14. Create unit tests
15. Create integration tests

---

## VI. Configuration Files

### `.env.local` (if needed)
```env
# Sound system config (optional)
NEXT_PUBLIC_SOUND_PRELOAD_BATCH_SIZE=5
NEXT_PUBLIC_SOUND_CACHE_MAX_MB=100
NEXT_PUBLIC_SOUND_LOG_LEVEL=info
```

### No Changes Needed
- ❌ `olympia-sound-config.json` - READ ONLY
- ❌ `package.json` - All required APIs already available (Web Audio API)
- ❌ `tsconfig.json` - No special config needed

---

## VII. Testing Files (Optional)

```
tests/olympia/
├── soundCacheManager.test.ts
├── overrideRulesEngine.test.ts
├── soundController.test.ts
├── soundEventDispatcher.test.ts
└── integration/
    ├── roundFlow.test.ts
    ├── eventMapping.test.ts
    └── edgeCases.test.ts
```

---

## VIII. Documentation Files (Already Created)

```
docs/olympia/
├── SOUND_ARCHITECTURE.md          ✅ Created
├── SOUND_QUICK_REFERENCE.md       ✅ Created
└── SOUND_IMPLEMENTATION.md        [You're reading this]
```

---

## IX. Build & Lint Considerations

### Strict Type Checking
```typescript
// Ensure NO 'any' types
// Ensure NO implicit 'any'
// Use interfaces for all complex types
```

### Code Style
- ESLint config: Use existing project config
- Format: Use existing prettier config
- Imports: Organize with absolute paths (`@/lib/olympia/sound`)

### No Breaking Changes
- ✅ All changes in `lib/olympia/sound/*` (new folder)
- ✅ New hooks in `hooks/olympia/*` (new folder)
- ✅ Docs in `docs/olympia/*`
- ❌ No modifications to existing files EXCEPT:
  - `components/olympia/.../useOlympiaGameState.ts` (add dispatcher)
  - `components/olympia/.../HostRealtimeEventsListener.tsx` (add dispatcher)

---

## X. Git Commit Strategy

```bash
# Commit 1: Foundation
git commit -m "feat(sound): Add core types and constants"

# Commit 2: Core managers
git commit -m "feat(sound): Implement cache and state managers"

# Commit 3: Controller
git commit -m "feat(sound): Implement SoundController with override rules"

# Commit 4: Event handling
git commit -m "feat(sound): Add SoundEventDispatcher and React hooks"

# Commit 5: Integration
git commit -m "feat(sound): Integrate sound system into game flow"

# Commit 6: Tests
git commit -m "test(sound): Add unit and integration tests"

# Commit 7: Docs
git commit -m "docs(sound): Add implementation documentation"
```

---

## XI. Checklist Before Starting Implementation

- [ ] Read SOUND_ARCHITECTURE.md (Section III - Config Analysis)
- [ ] Read SOUND_ARCHITECTURE.md (Section V - Event-Sound Mapping)
- [ ] Review olympia-sound-config.json
- [ ] Understand Web Audio API basics
- [ ] Check if AudioContext is new to the codebase
- [ ] Verify Supabase storage access (test URL)
- [ ] Review existing event system (realtime-guard.ts)
- [ ] Plan test cases based on edge cases (Section VIII)
- [ ] Setup development environment

---

**Next Step:** Begin implementation with Step 1 (Foundation files)

**Reference:** Use SOUND_QUICK_REFERENCE.md while coding
