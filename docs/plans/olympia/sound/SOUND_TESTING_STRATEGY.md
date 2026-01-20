# Sound System - Testing Strategy & Test Cases

**Phiên bản:** 1.0  
**Cập nhật:** 2026-01-20

---

## I. Testing Overview

### Test Pyramid
```
                      ▲
                     /│\
                    / │ \
                   /  │  \ E2E Tests (10%)
                  /   │   \ 
                 /    │    \─────────────────────
                /     │     \ Integration Tests (20%)
               /      │      \
              /       │       \─────────────────────
             /        │        \ Unit Tests (70%)
            /─────────┼─────────\
           ▼          ▼          ▼
```

### Test Categories
1. **Unit Tests** (70%) - Individual components in isolation
2. **Integration Tests** (20%) - Components working together
3. **E2E Tests** (10%) - Full game flow simulation

---

## II. Unit Tests

### 1. SoundCacheManager Tests

#### Test Suite: `soundCacheManager.test.ts`

```typescript
describe("SoundCacheManager", () => {
  let cacheManager: SoundCacheManager
  let mockAudioContext: AudioContext
  
  beforeEach(() => {
    mockAudioContext = createMockAudioContext()
    cacheManager = new SoundCacheManager(soundConfig, mockAudioContext)
  })

  // ========== Preload Tests ==========
  describe("preloadSound", () => {
    
    test("should fetch and decode sound successfully", async () => {
      // Arrange
      const soundKey = "kd_dung"
      
      // Act
      await cacheManager.preloadSound(soundKey)
      
      // Assert
      expect(cacheManager.isReady(soundKey)).toBe(true)
      expect(cacheManager.getAudioBuffer(soundKey)).not.toBeNull()
    })

    test("should handle 404 error gracefully", async () => {
      // Arrange
      const soundKey = "nonexistent_sound"
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      })
      
      // Act
      await cacheManager.preloadSound(soundKey)
      
      // Assert
      expect(cacheManager.isReady(soundKey)).toBe(false)
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("404")
      )
    })

    test("should retry on network timeout", async () => {
      // Arrange
      const soundKey = "kd_bat_dau_choi"
      mockFetch.mockRejectedValueOnce(new Error("Network timeout"))
      mockFetch.mockResolvedValueOnce(validAudioResponse)
      
      // Act
      await cacheManager.preloadSound(soundKey)
      
      // Assert
      expect(mockFetch).toHaveBeenCalledTimes(2) // Initial + retry
      expect(cacheManager.isReady(soundKey)).toBe(true)
    })

    test("should mark as failed after max retries", async () => {
      // Arrange
      const soundKey = "kd_dung"
      mockFetch.mockRejectedValue(new Error("Network error"))
      
      // Act
      await cacheManager.preloadSound(soundKey)
      
      // Assert
      expect(cacheManager.isReady(soundKey)).toBe(false)
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("failed after retries")
      )
    })

    test("should avoid duplicate preload requests", async () => {
      // Arrange
      const soundKey = "kd_hien_cau_hoi"
      
      // Act
      const promise1 = cacheManager.preloadSound(soundKey)
      const promise2 = cacheManager.preloadSound(soundKey)
      await Promise.all([promise1, promise2])
      
      // Assert
      expect(mockFetch).toHaveBeenCalledTimes(1) // Only called once
    })
  })

  describe("preloadSounds", () => {
    
    test("should batch load multiple sounds in parallel", async () => {
      // Arrange
      const soundKeys = ["kd_dung", "kd_sai", "kd_dem_gio_5s"]
      
      // Act
      const result = await cacheManager.preloadSounds(soundKeys)
      
      // Assert
      expect(result.loaded).toHaveLength(3)
      expect(result.failed).toHaveLength(0)
      soundKeys.forEach(key => {
        expect(cacheManager.isReady(key)).toBe(true)
      })
    })

    test("should batch load with max 5 parallel requests", async () => {
      // Arrange
      const soundKeys = Array.from({ length: 20 }, (_, i) => `sound_${i}`)
      
      // Act
      await cacheManager.preloadSounds(soundKeys)
      
      // Assert
      // Check that fetch is called in batches (should not exceed max concurrent)
      expect(maxConcurrentFetches).toBeLessThanOrEqual(5)
    })

    test("should handle partial failures", async () => {
      // Arrange
      const soundKeys = ["kd_dung", "bad_sound", "vcnv_mo_o_chu"]
      mockFetch.mockImplementationOnce((url) =>
        url.includes("bad_sound")
          ? Promise.reject(new Error("404"))
          : Promise.resolve(validAudioResponse)
      )
      
      // Act
      const result = await cacheManager.preloadSounds(soundKeys)
      
      // Assert
      expect(result.loaded).toHaveLength(2)
      expect(result.failed).toHaveLength(1)
      expect(result.failed[0]).toBe("bad_sound")
    })
  })

  // ========== Cache Query Tests ==========
  describe("isReady", () => {
    
    test("should return false for uncached sound", () => {
      // Arrange
      const soundKey = "kd_dung"
      
      // Act
      const ready = cacheManager.isReady(soundKey)
      
      // Assert
      expect(ready).toBe(false)
    })

    test("should return true after preload", async () => {
      // Arrange
      const soundKey = "kd_dung"
      await cacheManager.preloadSound(soundKey)
      
      // Act
      const ready = cacheManager.isReady(soundKey)
      
      // Assert
      expect(ready).toBe(true)
    })

    test("should return true for failed sound = false", async () => {
      // Arrange
      const soundKey = "bad_sound"
      mockFetch.mockRejectedValueOnce(new Error("404"))
      await cacheManager.preloadSound(soundKey)
      
      // Act
      const ready = cacheManager.isReady(soundKey)
      
      // Assert
      expect(ready).toBe(false)
    })
  })

  describe("getAudioBuffer", () => {
    
    test("should return null for uncached sound", () => {
      // Act
      const buffer = cacheManager.getAudioBuffer("unknown")
      
      // Assert
      expect(buffer).toBeNull()
    })

    test("should return valid AudioBuffer after preload", async () => {
      // Arrange
      const soundKey = "kd_dung"
      await cacheManager.preloadSound(soundKey)
      
      // Act
      const buffer = cacheManager.getAudioBuffer(soundKey)
      
      // Assert
      expect(buffer).toBeInstanceOf(AudioBuffer)
      expect(buffer.length).toBeGreaterThan(0)
    })
  })

  // ========== Cache Management Tests ==========
  describe("clearSound", () => {
    
    test("should clear specific sound from cache", async () => {
      // Arrange
      const soundKey = "kd_dung"
      await cacheManager.preloadSound(soundKey)
      
      // Act
      cacheManager.clearSound(soundKey)
      
      // Assert
      expect(cacheManager.isReady(soundKey)).toBe(false)
    })

    test("should not affect other sounds", async () => {
      // Arrange
      const sound1 = "kd_dung"
      const sound2 = "kd_sai"
      await cacheManager.preloadSounds([sound1, sound2])
      
      // Act
      cacheManager.clearSound(sound1)
      
      // Assert
      expect(cacheManager.isReady(sound1)).toBe(false)
      expect(cacheManager.isReady(sound2)).toBe(true)
    })
  })

  describe("clearAll", () => {
    
    test("should clear all cached sounds", async () => {
      // Arrange
      const soundKeys = ["kd_dung", "kd_sai", "vcnv_mo_o_chu"]
      await cacheManager.preloadSounds(soundKeys)
      
      // Act
      cacheManager.clearAll()
      
      // Assert
      soundKeys.forEach(key => {
        expect(cacheManager.isReady(key)).toBe(false)
      })
    })
  })

  describe("getStatus", () => {
    
    test("should return cache status summary", async () => {
      // Arrange
      await cacheManager.preloadSound("kd_dung")
      mockFetch.mockRejectedValueOnce(new Error("404"))
      await cacheManager.preloadSound("bad_sound")
      
      // Act
      const status = cacheManager.getStatus()
      
      // Assert
      expect(status.loaded).toContain("kd_dung")
      expect(status.failed).toContain("bad_sound")
      expect(status.pending).toBeDefined()
    })
  })
})
```

---

### 2. OverrideRulesEngine Tests

#### Test Suite: `overrideRulesEngine.test.ts`

```typescript
describe("OverrideRulesEngine", () => {
  let engine: OverrideRulesEngine
  
  beforeEach(() => {
    engine = new OverrideRulesEngine(soundConfig)
  })

  // ========== Override Rules Tests ==========
  describe("getSoundsThatMustStop", () => {
    
    test("should stop timer when playing correct answer", () => {
      // Act
      const mustStop = engine.getSoundsThatMustStop("kd_dung")
      
      // Assert
      expect(mustStop).toContain("kd_dem_gio_5s")
    })

    test("should NOT stop background loop for correct answer", () => {
      // Act
      const mustStop = engine.getSoundsThatMustStop("kd_dung")
      
      // Assert
      expect(mustStop).not.toContain("kd_bat_dau_choi")
    })

    test("should return empty array for no special rule", () => {
      // Act
      const mustStop = engine.getSoundsThatMustStop("chuong")
      
      // Assert
      expect(mustStop).toHaveLength(0)
    })

    test("should stop all sounds for star sound", () => {
      // Act
      const mustStop = engine.getSoundsThatMustStop("vd_ngoi_sao")
      
      // Assert
      const allSounds = Object.keys(soundConfig.sounds)
      expect(mustStop.length).toBe(allSounds.length)
    })

    test("should stop other timers but not this countdown", () => {
      // Act (checking VCNV timer)
      const mustStop = engine.getSoundsThatMustStop("vcnv_dem_gio_15s")
      
      // Assert (should stop other timers)
      expect(mustStop).toContain("kd_dem_gio_5s")
      expect(mustStop).toContain("vd_dem_gio_15s")
      // But not other sounds
      expect(mustStop).not.toContain("vcnv_mo_cau_hoi")
    })
  })

  describe("canOverride", () => {
    
    test("should allow correct answer to override timer", () => {
      // Act
      const canOverride = engine.canOverride("kd_dung", "kd_dem_gio_5s")
      
      // Assert
      expect(canOverride).toBe(true)
    })

    test("should NOT allow timer to override correct answer", () => {
      // Act
      const canOverride = engine.canOverride("kd_dem_gio_5s", "kd_dung")
      
      // Assert
      expect(canOverride).toBe(false)
    })

    test("should allow star to override anything", () => {
      // Act
      const canOverride = engine.canOverride("vd_ngoi_sao", "kd_dung")
      
      // Assert
      expect(canOverride).toBe(true)
    })
  })

  describe("getPriority", () => {
    
    test("should return MAXIMUM for star sound", () => {
      // Act
      const priority = engine.getPriority("vd_ngoi_sao")
      
      // Assert
      expect(priority).toBe(PRIORITY.MAXIMUM)
    })

    test("should return CRITICAL for correct answer", () => {
      // Act
      const priority = engine.getPriority("kd_dung")
      
      // Assert
      expect(priority).toBe(PRIORITY.CRITICAL)
    })

    test("should return NORMAL for notification", () => {
      // Act
      const priority = engine.getPriority("chuong")
      
      // Assert
      expect(priority).toBe(PRIORITY.NORMAL)
    })

    test("should compare priorities correctly", () => {
      // Act
      const priorityCorrect = engine.getPriority("kd_dung")
      const priorityTimer = engine.getPriority("kd_dem_gio_5s")
      
      // Assert
      expect(priorityCorrect).toBeGreaterThan(priorityTimer)
    })
  })

  describe("getSoundGroup", () => {
    
    test("should return all sounds in COUNTDOWN group", () => {
      // Act
      const group = engine.getSoundGroup("COUNTDOWN")
      
      // Assert
      expect(group).toContain("kd_dem_gio_5s")
      expect(group).toContain("vcnv_dem_gio_15s")
      expect(group).not.toContain("kd_dung")
    })

    test("should return empty array for unknown group", () => {
      // Act
      const group = engine.getSoundGroup("UNKNOWN_GROUP")
      
      // Assert
      expect(group).toHaveLength(0)
    })
  })
})
```

---

### 3. PlaybackStateManager Tests

#### Test Suite: `playbackStateManager.test.ts`

```typescript
describe("PlaybackStateManager", () => {
  let stateManager: PlaybackStateManager
  let mockSourceNode: AudioBufferSourceNode
  
  beforeEach(() => {
    stateManager = new PlaybackStateManager()
    mockSourceNode = createMockSourceNode()
  })

  describe("setPlaying", () => {
    
    test("should set sound to playing state", () => {
      // Act
      stateManager.setPlaying("kd_dung", mockSourceNode)
      
      // Assert
      expect(stateManager.isPlaying("kd_dung")).toBe(true)
      expect(stateManager.getState("kd_dung").state).toBe("playing")
    })

    test("should store source node reference", () => {
      // Act
      stateManager.setPlaying("kd_dung", mockSourceNode)
      
      // Assert
      const state = stateManager.getState("kd_dung")
      expect(state.sourceNode).toBe(mockSourceNode)
    })
  })

  describe("setStopped", () => {
    
    test("should set sound to stopped state", () => {
      // Arrange
      stateManager.setPlaying("kd_dung", mockSourceNode)
      
      // Act
      stateManager.setStopped("kd_dung")
      
      // Assert
      expect(stateManager.isPlaying("kd_dung")).toBe(false)
      expect(stateManager.getState("kd_dung").state).toBe("stopped")
    })
  })

  describe("getPlayingKeys", () => {
    
    test("should return all currently playing sounds", () => {
      // Arrange
      stateManager.setPlaying("kd_dung", mockSourceNode)
      stateManager.setPlaying("kd_dem_gio_5s", mockSourceNode)
      
      // Act
      const playingKeys = stateManager.getPlayingKeys()
      
      // Assert
      expect(playingKeys).toContain("kd_dung")
      expect(playingKeys).toContain("kd_dem_gio_5s")
      expect(playingKeys).toHaveLength(2)
    })

    test("should not include stopped sounds", () => {
      // Arrange
      stateManager.setPlaying("kd_dung", mockSourceNode)
      stateManager.setPlaying("kd_sai", mockSourceNode)
      stateManager.setStopped("kd_sai")
      
      // Act
      const playingKeys = stateManager.getPlayingKeys()
      
      // Assert
      expect(playingKeys).toContain("kd_dung")
      expect(playingKeys).not.toContain("kd_sai")
    })
  })
})
```

---

### 4. SoundController Tests

#### Test Suite: `soundController.test.ts`

```typescript
describe("SoundController", () => {
  let controller: SoundController
  let mockCache: SoundCacheManager
  let mockPlaybackState: PlaybackStateManager
  let mockOverrideRules: OverrideRulesEngine
  
  beforeEach(() => {
    mockCache = createMockSoundCacheManager()
    mockPlaybackState = new PlaybackStateManager()
    mockOverrideRules = createMockOverrideRulesEngine()
    controller = new SoundController(
      mockCache,
      mockPlaybackState,
      mockOverrideRules
    )
  })

  describe("play", () => {
    
    test("should fail if sound not cached", async () => {
      // Arrange
      mockCache.isReady.mockReturnValue(false)
      
      // Act
      const result = await controller.play("kd_dung")
      
      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toContain("not cached")
    })

    test("should play sound if cached", async () => {
      // Arrange
      mockCache.isReady.mockReturnValue(true)
      mockCache.getAudioBuffer.mockReturnValue(mockAudioBuffer)
      
      // Act
      const result = await controller.play("kd_dung")
      
      // Assert
      expect(result.success).toBe(true)
    })

    test("should apply override rules before playing", async () => {
      // Arrange
      mockCache.isReady.mockReturnValue(true)
      mockPlaybackState.setPlaying("kd_dem_gio_5s", mockSourceNode)
      mockOverrideRules.getSoundsThatMustStop.mockReturnValue(["kd_dem_gio_5s"])
      
      // Act
      await controller.play("kd_dung")
      
      // Assert
      expect(mockPlaybackState.isPlaying("kd_dem_gio_5s")).toBe(false)
      expect(mockPlaybackState.isPlaying("kd_dung")).toBe(true)
    })

    test("should respect play delay option", async () => {
      // Arrange
      const delayMs = 1000
      mockCache.isReady.mockReturnValue(true)
      
      // Act
      const start = Date.now()
      await controller.play("kd_dung", { delay: delayMs })
      const elapsed = Date.now() - start
      
      // Assert
      expect(elapsed).toBeGreaterThanOrEqual(delayMs)
    })

    test("should call onEnd callback when sound finishes", async () => {
      // Arrange
      const onEnd = jest.fn()
      mockCache.isReady.mockReturnValue(true)
      
      // Act
      await controller.play("kd_dung", { onEnd })
      // Simulate sound ending
      mockSourceNode.onended()
      
      // Assert
      expect(onEnd).toHaveBeenCalled()
    })
  })

  describe("stop", () => {
    
    test("should stop playing sound", async () => {
      // Arrange
      mockCache.isReady.mockReturnValue(true)
      await controller.play("kd_dung")
      
      // Act
      controller.stop("kd_dung")
      
      // Assert
      expect(mockPlaybackState.isPlaying("kd_dung")).toBe(false)
    })

    test("should not error if sound not playing", () => {
      // Act & Assert
      expect(() => {
        controller.stop("nonexistent")
      }).not.toThrow()
    })
  })

  describe("stopGroup", () => {
    
    test("should stop all sounds in group", async () => {
      // Arrange
      mockCache.isReady.mockReturnValue(true)
      mockOverrideRules.getSoundGroup.mockReturnValue(["kd_dem_gio_5s", "vcnv_dem_gio_15s"])
      await controller.play("kd_dem_gio_5s")
      await controller.play("vcnv_dem_gio_15s")
      
      // Act
      controller.stopGroup("COUNTDOWN")
      
      // Assert
      expect(mockPlaybackState.isPlaying("kd_dem_gio_5s")).toBe(false)
      expect(mockPlaybackState.isPlaying("vcnv_dem_gio_15s")).toBe(false)
    })
  })

  describe("stopAll", () => {
    
    test("should stop all playing sounds", async () => {
      // Arrange
      mockCache.isReady.mockReturnValue(true)
      await controller.play("kd_dung")
      await controller.play("kd_dem_gio_5s")
      
      // Act
      controller.stopAll()
      
      // Assert
      expect(mockPlaybackState.getPlayingKeys()).toHaveLength(0)
    })
  })

  describe("isCached", () => {
    
    test("should return true if sound cached", () => {
      // Arrange
      mockCache.isReady.mockReturnValue(true)
      
      // Act
      const cached = controller.isCached("kd_dung")
      
      // Assert
      expect(cached).toBe(true)
    })

    test("should return false if sound not cached", () => {
      // Arrange
      mockCache.isReady.mockReturnValue(false)
      
      // Act
      const cached = controller.isCached("kd_dung")
      
      // Assert
      expect(cached).toBe(false)
    })
  })
})
```

---

## III. Integration Tests

### 1. Full Round Flow

#### Test: `integration/roundFlow.test.ts`

```typescript
describe("Integration: Full Round Flow", () => {
  let soundController: SoundController
  let soundCache: SoundCacheManager
  let eventDispatcher: SoundEventDispatcher
  let mockEventBus: EventBus
  
  beforeEach(async () => {
    // Initialize all components
    soundCache = new SoundCacheManager(soundConfig, audioContext)
    soundController = new SoundController(
      soundCache,
      new PlaybackStateManager(),
      new OverrideRulesEngine(soundConfig)
    )
    
    // Preload all sounds
    await soundCache.preloadSounds(
      Object.keys(soundConfig.sounds)
    )
    
    // Setup dispatcher
    mockEventBus = createMockEventBus()
    eventDispatcher = new SoundEventDispatcher(soundController)
    eventDispatcher.initialize(mockEventBus)
  })

  test("should play kd_bat_dau_choi when round starts", async () => {
    // Act
    mockEventBus.emit("ROUND_STARTED", {
      roundType: "khoi_dong"
    })
    
    // Assert
    await wait(100)
    expect(soundController.getState("kd_bat_dau_choi").state).toBe("playing")
  })

  test("should play kd_hien_cau_hoi after 3s delay", async () => {
    // Act
    mockEventBus.emit("ROUND_STARTED", {
      roundType: "khoi_dong"
    })
    
    // Assert (before delay)
    expect(soundController.getState("kd_hien_cau_hoi").state).not.toBe("playing")
    
    // Wait for delay
    await wait(3100)
    
    // Assert (after delay)
    expect(soundController.getState("kd_hien_cau_hoi").state).toBe("playing")
  })

  test("should stop timer when correct answer", async () => {
    // Arrange
    mockEventBus.emit("ROUND_STARTED", { roundType: "khoi_dong" })
    mockEventBus.emit("TIMER_STARTED", { durationMs: 5000 })
    
    // Act
    mockEventBus.emit("CORRECT_ANSWER", { roundType: "khoi_dong" })
    
    // Assert
    await wait(100)
    expect(soundController.getState("kd_dem_gio_5s").state).toBe("stopped")
    expect(soundController.getState("kd_dung").state).toBe("playing")
  })

  test("should handle full round sequence", async () => {
    // Act & Assert sequence
    
    // 1. Round start
    mockEventBus.emit("ROUND_STARTED", { roundType: "khoi_dong" })
    expect(soundController.getState("kd_bat_dau_choi").state).toBe("playing")
    
    // 2. Wait for question reveal
    await wait(3500)
    expect(soundController.getState("kd_hien_cau_hoi").state).toBe("playing")
    
    // 3. Timer starts
    mockEventBus.emit("TIMER_STARTED", { durationMs: 5000 })
    expect(soundController.getState("kd_dem_gio_5s").state).toBe("playing")
    
    // 4. Correct answer
    mockEventBus.emit("CORRECT_ANSWER", { roundType: "khoi_dong" })
    expect(soundController.getState("kd_dung").state).toBe("playing")
    expect(soundController.getState("kd_dem_gio_5s").state).toBe("stopped")
    
    // 5. Round end
    await wait(2500)
    mockEventBus.emit("ROUND_ENDED", {})
    expect(soundController.getState("kd_hoan_thanh").state).toBe("playing")
  })
})
```

---

### 2. Override Rules Interaction

#### Test: `integration/overrideInteraction.test.ts`

```typescript
describe("Integration: Override Rules", () => {
  let soundController: SoundController
  let soundCache: SoundCacheManager
  
  beforeEach(async () => {
    soundCache = new SoundCacheManager(soundConfig, audioContext)
    soundController = new SoundController(
      soundCache,
      new PlaybackStateManager(),
      new OverrideRulesEngine(soundConfig)
    )
    await soundCache.preloadSounds(Object.keys(soundConfig.sounds))
  })

  test("should keep background loop while playing timer", async () => {
    // Act
    await soundController.play("kd_bat_dau_choi")
    await soundController.play("kd_dem_gio_5s")
    
    // Assert
    expect(soundController.isPlaying("kd_bat_dau_choi")).toBe(true)
    expect(soundController.isPlaying("kd_dem_gio_5s")).toBe(true)
  })

  test("should stop timer when correct answer plays", async () => {
    // Arrange
    await soundController.play("kd_dem_gio_5s")
    expect(soundController.isPlaying("kd_dem_gio_5s")).toBe(true)
    
    // Act
    await soundController.play("kd_dung")
    
    // Assert
    expect(soundController.isPlaying("kd_dem_gio_5s")).toBe(false)
    expect(soundController.isPlaying("kd_dung")).toBe(true)
  })

  test("should allow reveal answer sounds to overlap", async () => {
    // Act
    await soundController.play("tt_mo_dap_an")
    await wait(500)
    await soundController.play("vcnv_xem_dap_an")
    
    // Assert
    expect(soundController.isPlaying("tt_mo_dap_an")).toBe(true)
    expect(soundController.isPlaying("vcnv_xem_dap_an")).toBe(true)
  })

  test("star sound should stop everything", async () => {
    // Arrange
    await soundController.play("kd_bat_dau_choi")
    await soundController.play("kd_dem_gio_5s")
    await soundController.play("kd_hien_cau_hoi")
    
    // Act
    await soundController.play("vd_ngoi_sao")
    
    // Assert
    expect(soundController.isPlaying("kd_bat_dau_choi")).toBe(false)
    expect(soundController.isPlaying("kd_dem_gio_5s")).toBe(false)
    expect(soundController.isPlaying("kd_hien_cau_hoi")).toBe(false)
    expect(soundController.isPlaying("vd_ngoi_sao")).toBe(true)
  })
})
```

---

## IV. E2E Tests (Simulation)

### Test: `e2e/fullSessionSimulation.test.ts`

```typescript
describe("E2E: Full Olympia Session", () => {
  let soundSystem: SoundSystem
  let gameSimulator: GameSimulator
  
  beforeEach(async () => {
    soundSystem = new SoundSystem()
    await soundSystem.initialize()
    gameSimulator = new GameSimulator()
  })

  test("should handle complete Olympia session without errors", async () => {
    // Session Start (Preload)
    const preloadStart = Date.now()
    gameSimulator.emit("SESSION_START")
    await soundSystem.waitForCacheReady()
    const preloadTime = Date.now() - preloadStart
    expect(preloadTime).toBeLessThan(10000) // Within 10s
    
    // Round 1: Khởi Động
    gameSimulator.emit("ROUND_START", { roundType: "khoi_dong" })
    await wait(100)
    expect(soundSystem.isPlaying("kd_bat_dau_choi")).toBe(true)
    
    gameSimulator.emit("TIMER_START")
    await wait(100)
    expect(soundSystem.isPlaying("kd_dem_gio_5s")).toBe(true)
    
    gameSimulator.emit("CORRECT_ANSWER", { playerId: "p1" })
    await wait(100)
    expect(soundSystem.isPlaying("kd_dung")).toBe(true)
    expect(soundSystem.isPlaying("kd_dem_gio_5s")).toBe(false)
    
    gameSimulator.emit("ROUND_END")
    await wait(100)
    expect(soundSystem.isPlaying("kd_hoan_thanh")).toBe(true)
    
    // Round 2, 3, etc. (abbreviated)
    
    // Session End
    gameSimulator.emit("SESSION_END")
    await wait(100)
    expect(soundSystem.isCached("kd_dung")).toBe(false) // Cache cleared
  })

  test("should handle rapid round transitions", async () => {
    // This tests the app's resilience to quick clicks
    await soundSystem.initialize()
    
    // Rapid transitions
    gameSimulator.emit("ROUND_START", { roundType: "khoi_dong" })
    await wait(500)
    gameSimulator.emit("ROUND_END")
    await wait(100)
    gameSimulator.emit("ROUND_START", { roundType: "vcnv" })
    await wait(100)
    gameSimulator.emit("ROUND_END")
    
    // Should not crash
    expect(soundSystem.isHealthy()).toBe(true)
  })

  test("should handle browser tab visibility changes", async () => {
    // Simulate tab hidden/visible
    gameSimulator.emit("ROUND_START", { roundType: "khoi_dong" })
    
    // Hide tab
    await soundSystem.handleVisibilityChange("hidden")
    expect(soundSystem.allSoundsStopped()).toBe(true)
    
    // Show tab
    await soundSystem.handleVisibilityChange("visible")
    // Sounds resume based on current game state
    expect(soundSystem.isHealthy()).toBe(true)
  })
})
```

---

## V. Test Data & Mocks

### Mock Audio Context

```typescript
function createMockAudioContext(): AudioContext {
  return {
    createBufferSource: jest.fn(() => ({
      buffer: null,
      loop: false,
      connect: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      onended: null
    })),
    createGain: jest.fn(() => ({
      gain: { value: 1 },
      connect: jest.fn()
    })),
    destination: {},
    close: jest.fn()
  } as any
}
```

### Mock Sound Config

```typescript
const mockSoundConfig: OlympiaSoundConfig = {
  meta: {
    version: "1.0.0",
    default: {
      autoStopWhenOtherPlays: false,
      loop: false,
      volume: 1.0
    }
  },
  sounds: {
    kd_bat_dau_choi: {
      file: "1 bat dau choi",
      loop: true,
      autoStopWhenOtherPlays: false
    },
    kd_dung: {
      file: "1 tra loi dung",
      autoStopWhenOtherPlays: true
    },
    // ... rest of sounds
  }
}
```

---

## VI. Test Coverage Goals

| Component | Unit | Integration | E2E | Target |
|-----------|------|-------------|-----|--------|
| SoundCacheManager | 100% | 80% | 70% | 85%+ |
| PlaybackStateManager | 100% | 85% | 75% | 85%+ |
| OverrideRulesEngine | 100% | 90% | 80% | 90%+ |
| SoundController | 95% | 85% | 75% | 85%+ |
| SoundEventDispatcher | 90% | 85% | 80% | 85%+ |
| **Overall** | 95% | 85% | 75% | **85%+** |

---

## VII. Running Tests

### Test Commands

```bash
# All tests
pnpm test sound

# Unit tests only
pnpm test sound --testPathPattern="soundCacheManager|soundController|overrideRulesEngine"

# Integration tests
pnpm test sound --testPathPattern="integration"

# E2E tests
pnpm test sound --testPathPattern="e2e"

# Watch mode
pnpm test sound --watch

# With coverage
pnpm test sound --coverage
```

---

## VIII. CI/CD Integration

### GitHub Actions Workflow

```yaml
name: Sound System Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
          cache: 'pnpm'
      
      - run: pnpm install
      - run: pnpm test sound --coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v2
        with:
          file: ./coverage/sound.lcov
          flags: sound
          fail_ci_if_error: true
```

---

**✅ Test strategy complete. Ready for implementation phase.**
