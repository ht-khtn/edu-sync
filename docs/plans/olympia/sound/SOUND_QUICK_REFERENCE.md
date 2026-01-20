# Sound System - Quick Reference & Implementation Checklist

**File này cung cấp:**
- Priority Matrix (sound phát trong trường hợp nào)
- Override Decision Tree
- State Transition Diagram
- Quick implementation checklist
- FAQ & Common Pitfalls

---

## I. Priority Matrix - Khi Nào Phát Sound Gì

### Format: [Event] → [Sound] | [Stop Others?] | [Loop?] | [Timing]

#### **VÒNG KHỞI ĐỘNG (khoi_dong)**

```
┌─ RoundStart
│  ├─ Play: kd_bat_dau_choi (Background)
│  │   └─ Stop: [NONE - background loop]
│  │   └─ Timing: Immediate
│  │
│  ├─ [After 3s]
│  └─ Play: kd_hien_cau_hoi (Question reveal)
│     └─ Stop: [NONE]
│     └─ Timing: Delayed 3000ms
│     └─ OnEnd: Signal UI to show question
│
├─ TimerStart
│  └─ Play: kd_dem_gio_5s (Countdown)
│     └─ Stop: [NONE - runs alongside background]
│     └─ Loop: false
│
├─ CorrectAnswer
│  ├─ Stop: kd_dem_gio_5s [IMMEDIATELY]
│  └─ Play: kd_dung
│     └─ Stop others: [EXCLUDE background loop]
│     └─ autoStopWhenOtherPlays: true
│
├─ WrongAnswer
│  ├─ Stop: kd_dem_gio_5s
│  └─ Play: kd_sai
│     └─ Stop others: [EXCLUDE background]
│
└─ RoundEnd
   ├─ Stop: kd_bat_dau_choi (Background loop)
   ├─ Stop: Tất cả sound phát
   └─ Play: kd_hoan_thanh
      └─ OnEnd: Ready for next round
```

#### **VCNV (vcnv)**

```
├─ RoundStart
│  └─ Play: vcnv_chon_hang_ngang (Select row sound)
│     └─ Timing: Immediate OR on player click
│     └─ OnEnd → Play vcnv_mo_cau_hoi
│
├─ QuestionRevealed
│  └─ Play: vcnv_mo_cau_hoi
│     └─ Stop: vcnv_chon_hang_ngang
│     └─ OnEnd: Signal UI to show question
│
├─ TimerStart
│  └─ Play: vcnv_dem_gio_15s
│     └─ autoStopWhenOtherPlays: true
│
├─ CorrectAnswer (only if ALL scored)
│  ├─ Stop: vcnv_dem_gio_15s
│  └─ Play: vcnv_dung (optional, tuỳ logic)
│
├─ OpenImage
│  └─ Play: vcnv_mo_hinh_anh
│     └─ autoStopWhenOtherPlays: true
│
└─ OpenTile
   └─ Play: vcnv_mo_o_chu
      └─ autoStopWhenOtherPlays: true
```

#### **TĂNG TỐC (tang_toc)**

```
├─ RoundStart
│  └─ Play: tt_mo_cau_hoi
│     └─ OnEnd: Signal UI to show question + start timer
│
├─ TimerStart
│  └─ IF question has video:
│     └─ [NO SOUND] - video start = timer start
│  └─ ELSE:
│     └─ Play: tt_dem_gio_20s OR tt_dem_gio_30s
│        └─ autoStopWhenOtherPlays: true
│
├─ RevealAnswer
│  ├─ Stop: Timer sound
│  ├─ Play: tt_mo_dap_an [NOT autoStop]
│  ├─ Wait: 1000ms
│  └─ Play: vcnv_xem_dap_an [OVERLAY with prev]
│     └─ ALLOW OVERLAP (special case)
│
└─ RoundEnd
   └─ Play: (tuỳ logic)
```

#### **VỀ ĐÍCH (ve_dich)**

```
├─ RoundStart
│  ├─ Play: vd_bat_dau_choi (optional, tuỳ phase)
│  └─ Play: vd_cac_goi (Danh sách gói)
│     └─ autoStopWhenOtherPlays: true
│
├─ SelectCategory
│  ├─ Play: vd_lua_chon_goi
│  └─ OnEnd: Start timer
│
├─ TimerStart
│  └─ Play: vd_dem_gio_15s OR vd_dem_gio_20s
│     └─ autoStopWhenOtherPlays: true
│
├─ CorrectAnswer
│  ├─ Stop: Timer
│  └─ Play: vd_dung
│     └─ autoStopWhenOtherPlays: true
│
├─ WrongAnswer
│  ├─ Stop: Timer
│  └─ Play: vd_sai
│     └─ autoStopWhenOtherPlays: true
│
├─ StarRevealed ⭐
│  ├─ Stop: ALL sounds [PRIORITY MAX]
│  └─ Play: vd_ngoi_sao
│     └─ autoStopWhenOtherPlays: true
│
└─ RoundEnd
   └─ Play: vd_hoan_thanh
      └─ OnEnd: Summary
```

#### **GLOBAL EVENTS**

```
├─ SessionStart (User vào thi)
│  └─ [PRELOAD ALL SOUNDS]
│     └─ Show loading progress
│     └─ Batch load 5-10 sounds parallel
│
├─ TongKetDiem (End match)
│  └─ Play: tong_ket_diem
│     └─ autoStopWhenOtherPlays: true
│
├─ TongKetKetQua (Final results)
│  └─ Play: tong_ket_ket_qua
│     └─ autoStopWhenOtherPlays: true
│     └─ OnEnd: Clear cache + close AudioContext
│
├─ Notification (Thông báo)
│  └─ Play: chuong
│     └─ autoStopWhenOtherPlays: false
│     └─ Can overlap with others
│
└─ SessionEnd (User rời thi)
   └─ stopAll() + clearCache()
```

---

## II. Override Decision Tree

```
                          ┌─ Play New Sound
                          │
                    ┌─────▼─────┐
                    │ Check Cache│
                    └─────┬─────┘
                          │
                  ┌───────▼────────┐
                  │ Cached? (Y/N)  │
                  └───┬────────┬───┘
                      │        │
                  [YES]│        │[NO]
                      │        │
                      ▼        ▼
                  ┌────────┐ ┌──────────────┐
                  │ Ready  │ │ Return FAIL  │
                  │to Play │ │ (not cached) │
                  └───┬────┘ └──────────────┘
                      │
              ┌───────▼────────┐
              │ Check Override │
              │ Rules Engine   │
              └───┬────────┬───┘
                  │        │
         ┌────────▼───┐  ┌─▼────────────┐
         │ Must stop  │  │ Can play     │
         │ other      │  │ alongside    │
         │ sounds?    │  │ existing     │
         └────┬───────┘  └──────────────┘
              │                  │
       ┌──────▼──────┐          ▼
       │ Stop those  │      Play sound
       │ sounds      │      (DIRECT)
       │ (per rules) │
       └──────┬──────┘
              │
              ▼
          Play sound
          (after stop)
```

---

## III. State Transition Diagram

```
                    ┌──────────┐
                    │   IDLE   │
                    └──────┬───┘
                           │ play()
                    ┌──────▼────────┐
                    │   PLAYING     │◄─────┐
                    └──────┬─────┬──┘      │
                           │     │        │
                    stop() │     │pause() │
                           │     │        │
                    ┌──────▼──┐ ┌─▼──────┐│
                    │ STOPPED │ │PAUSED  ││
                    └─────────┘ └─┬──────┘│
                                  │      │
                                  │resume()
                                  │      │
                                  └──────┘

Event Triggers:
- play(soundKey) → IDLE → PLAYING
- stop() → PLAYING → STOPPED
- pause() → PLAYING → PAUSED
- resume() → PAUSED → PLAYING
- onended (source) → PLAYING → STOPPED (auto)
```

---

## IV. Implementation Checklist

### Phase 1: Core Infrastructure

- [ ] **Create SoundCacheManager**
  - [ ] Load olympia-sound-config.json
  - [ ] Create AudioContext
  - [ ] Implement preloadSound(soundKey)
  - [ ] Implement preloadSounds(soundKeys[])
  - [ ] Error handling: 404, network timeout, retry logic
  - [ ] Implement isReady(soundKey)
  - [ ] Implement getAudioBuffer(soundKey)
  - [ ] Test: preload single, preload batch, handle failures

- [ ] **Create PlaybackStateManager**
  - [ ] Initialize cache: Map<soundKey, PlaybackState>
  - [ ] Implement setPlaying(soundKey, sourceNode)
  - [ ] Implement setStopped(soundKey)
  - [ ] Implement setPaused(soundKey)
  - [ ] Implement getState(soundKey)
  - [ ] Implement getPlayingKeys()
  - [ ] Implement isPlaying(soundKey)
  - [ ] Test: state transitions, concurrent plays

- [ ] **Create OverrideRulesEngine**
  - [ ] Load rules from config (autoStopWhenOtherPlays)
  - [ ] Implement getSoundsThatMustStop(soundKey)
  - [ ] Implement canOverride(soundToPlay, currentlyPlaying)
  - [ ] Implement getPriority(soundKey)
  - [ ] Define sound groups (BACKGROUND, COUNTDOWN, SCORING, etc.)
  - [ ] Test: rule conflicts, priority sorting

- [ ] **Create buildSoundUrl Helper**
  - [ ] buildSoundUrl(fileName)
  - [ ] getSoundFileName(soundKey)
  - [ ] getSoundUrl(soundKey)
  - [ ] Unit test: URL encoding (space → %20)

### Phase 2: Sound Controller

- [ ] **Create SoundController**
  - [ ] Inject: SoundCacheManager, PlaybackStateManager, OverrideRulesEngine
  - [ ] Implement play(soundKey, options?)
    - [ ] Check cache ready
    - [ ] Apply override rules
    - [ ] Create source node
    - [ ] Set volume
    - [ ] Register onended callback
    - [ ] Start playback
    - [ ] Update state
  - [ ] Implement stop(soundKey)
  - [ ] Implement stopGroup(groupName)
  - [ ] Implement stopAll()
  - [ ] Implement pause(soundKey)
  - [ ] Implement resume(soundKey)
  - [ ] Implement setVolume(soundKey, volume)
  - [ ] Implement getState(soundKey)
  - [ ] Implement isCached(soundKey)
  - [ ] Test: play, stop, override, queue

### Phase 3: Event Dispatcher

- [ ] **Create SoundEventDispatcher**
  - [ ] Subscribe to game events (from useOlympiaGameState)
  - [ ] Implement handleGameEvent(eventType, payload)
  - [ ] Handle ROUND_STARTED
    - [ ] Route by roundType (khoi_dong, vcnv, tang_toc, ve_dich)
    - [ ] Play appropriate intro/background sound
    - [ ] Schedule question reveal sound
  - [ ] Handle QUESTION_REVEALED
  - [ ] Handle TIMER_STARTED
  - [ ] Handle CORRECT_ANSWER
  - [ ] Handle WRONG_ANSWER
  - [ ] Handle TIMER_ENDED
  - [ ] Handle ROUND_ENDED
  - [ ] Handle STAR_REVEALED
  - [ ] Handle REVEAL_ANSWER (Tăng Tốc)
  - [ ] Handle SESSION_STARTED (preload trigger)
  - [ ] Handle SESSION_ENDED (cleanup)
  - [ ] Test: event routing, sound sequencing

### Phase 4: Integration

- [ ] **Create useSound Hook**
  - [ ] Initialize SoundController, Dispatcher on mount
  - [ ] Subscribe game events
  - [ ] Cleanup on unmount
  - [ ] Expose soundController to components

- [ ] **Integration Tests**
  - [ ] Full round flow (khoi_dong): background → question → timer → correct
  - [ ] Override rules: correct answer stops timer
  - [ ] Edge case: round switched mid-sound
  - [ ] Edge case: spam click
  - [ ] Edge case: tab visibility change

- [ ] **Add Sound to Components**
  - [ ] useOlympiaGameState: Dispatch to SoundEventDispatcher
  - [ ] HostRealtimeEventsListener: Trigger sounds on admin actions
  - [ ] Round components: Call soundController when needed

### Phase 5: Testing & Polish

- [ ] **Unit Tests**
  - [ ] SoundCacheManager: preload, cache hit, cache miss, errors
  - [ ] OverrideRulesEngine: rules application, priority
  - [ ] SoundController: play, stop, override
  - [ ] URL builder: encoding, formatting

- [ ] **Integration Tests**
  - [ ] Full game session: preload → round 1 → ... → end
  - [ ] Event mapping: events → sounds
  - [ ] Timing: delays, sequencing, onEnd callbacks

- [ ] **Manual Testing**
  - [ ] Audio quality: clarity, volume consistency
  - [ ] Timing accuracy: sync with visuals
  - [ ] Edge cases: spam, pause/resume, network loss
  - [ ] Cross-browser: Chrome, Firefox, Safari

- [ ] **Documentation**
  - [ ] JSDoc for public APIs
  - [ ] Integration guide for developers
  - [ ] Troubleshooting guide

- [ ] **Monitoring**
  - [ ] Add logging for cache load, playback errors
  - [ ] Expose debug API (development only)
  - [ ] Track metrics (cache size, playback errors)

---

## V. Override Rules - Cheat Sheet

```
┌─────────────────────────────────────────────────────────────┐
│                    OVERRIDE RULES                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ RULE 1: autoStopWhenOtherPlays = true                      │
│ ├─ Play this sound                                        │
│ └─ → Stop all other sounds (EXCEPT BACKGROUND LOOPS)     │
│                                                             │
│ EXAMPLES:                                                  │
│ • kd_dung (correct) → Stop timer, stop question reveal   │
│ • vd_ngoi_sao (star) → Stop EVERYTHING                    │
│ • vcnv_mo_o_chu → Stop other interaction sounds           │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ RULE 2: Background Loop (loop = true)                     │
│ ├─ Play: kd_bat_dau_choi                                  │
│ └─ ONLY stop on:                                          │
│    • RoundEnded                                            │
│    • SessionEnded                                          │
│    • NewRound (switch vòng)                               │
│                                                             │
│ DON'T stop on:                                             │
│ • CorrectAnswer, WrongAnswer                              │
│ • Timer start/end                                         │
│ • Question reveal                                         │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ RULE 3: Timer Sound (Group COUNTDOWN)                     │
│ ├─ Max 1 timer at a time (EXCLUSIVE GROUP)                │
│ └─ Stop immediately on:                                   │
│    • CorrectAnswer → play kd_dung                          │
│    • WrongAnswer → play kd_sai                             │
│    • TimerEnded (auto)                                    │
│                                                             │
│ DON'T stop on:                                             │
│ • Question reveal sound                                   │
│ • Background loop                                         │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ RULE 4: Special Cases                                     │
│                                                             │
│ • Star (vd_ngoi_sao) → Priority MAXIMUM                   │
│   Stop everything, play star sound                        │
│                                                             │
│ • Reveal Answer (tt_mo_dap_an + vcnv_xem_dap_an)         │
│   → ALLOW OVERLAP (both autoStopWhenOtherPlays=false)     │
│                                                             │
│ • SelectRow (vcnv_chon_hang_ngang)                        │
│   → Wait for it to finish, then play vcnv_mo_cau_hoi      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## VI. Timing Reference

```
┌─────────────────────────────────────────────────────────────┐
│                   TIMING CONSTANTS                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ VÒNG KHỞI ĐỘNG:                                            │
│ ├─ RoundStart → Play kd_bat_dau_choi [IMMEDIATE]          │
│ ├─ Wait [3000ms] ← DELAY (configurable)                   │
│ ├─ Play kd_hien_cau_hoi                                   │
│ └─ OnEnd → UI show question                               │
│                                                             │
│ CHẤM ĐIỂM:                                                 │
│ ├─ CorrectAnswer → Play sound                              │
│ ├─ Wait [2000-3000ms] ← Display time                       │
│ └─ Continue or end round                                  │
│                                                             │
│ REVEAL ANSWER (Tăng Tốc):                                 │
│ ├─ Play tt_mo_dap_an                                       │
│ ├─ Wait [1000ms] ← Overlap window                          │
│ ├─ Play vcnv_xem_dap_an (SIMULTANEOUS)                    │
│ └─ Run to completion                                      │
│                                                             │
│ PRELOAD:                                                   │
│ ├─ SessionStart → Trigger preload                          │
│ ├─ Batch load 5-10 sounds [parallel]                       │
│ ├─ Timeout per sound [10000ms]                             │
│ ├─ Show progress                                           │
│ └─ Ready for round 1                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## VII. FAQ & Troubleshooting

### Q1: "Sound không phát"
**Checklist:**
1. Sound cached? `soundController.isCached(soundKey)` → NO
   - Trigger preload: `soundCache.preloadSound(soundKey)`
2. AudioContext suspended? Check browser console
   - Resume on first user interaction
3. Sound config exists? Check olympia-sound-config.json
   - Verify soundKey in config
4. Network error? Check browser Network tab
   - Retry preload, check URL format

### Q2: "Sound phát nhưng lag"
**Causes & Solutions:**
- Cache not ready: Ensure preload before play
- Browser resource: Close other tabs
- Slow network: Increase preload timeout

### Q3: "Sound chồng lên nhau gây nhiễu"
**Fix:**
- Check autoStopWhenOtherPlays in config
- Verify override rules engine
- Check getSoundsThatMustStop() logic
- Add more rules if needed

### Q4: "Correct answer sound không dừng timer"
**Debug:**
1. Check event sequence:
   - CORRECT_ANSWER event fired?
   - handleCorrectAnswer() called?
2. Check override rules:
   - `overrideEngine.getSoundsThatMustStop("kd_dung")`
   - Should include timer sound
3. Check stop() is called:
   - `soundController.stop("kd_dem_gio_5s")`
   - Verify stop() implementation

### Q5: "Star sound không priority cao"
**Check:**
- OverrideRulesEngine priority for vd_ngoi_sao: should be MAXIMUM (999)
- When star event fires:
  - `soundController.stopAll()` called first
  - Then `soundController.play("vd_ngoi_sao")`

### Q6: "Cache takes too much memory"
**Solution:**
- Monitor cache size: `soundCache.getStatus()`
- Set MAX_CACHE_SIZE_MB in constants
- Implement fallback to URL streaming
- Clear cache after session

### Q7: "User switches tab, sound cuts off"
**Fix:**
- Detect tab visibility change: `document.visibilitychange`
- On hidden: `soundController.stopAll()`
- On visible: Check if still in same round
  - If yes, resume if paused
  - If no, clear old sounds

---

## VIII. Common Pitfalls

❌ **DO NOT:**
1. Hardcode URL in play() → Use buildSoundUrl()
2. Create multiple AudioContext → Use singleton
3. Assume sound is cached → Always check isReady()
4. Modify olympia-sound-config.json in code → Read-only
5. Play sound without checking cache → Will fail
6. Forget to stop timer on CorrectAnswer → Sound overlap
7. Assume all browsers support AudioContext equally → Test cross-browser

✅ **DO:**
1. Use constants from olympia-sound-constants
2. Log with context (soundKey, event, error)
3. Test edge cases (spam, pause, tab switch)
4. Handle preload errors gracefully
5. Always call cleanup on unmount
6. Verify timing with actual game flow
7. Monitor cache stats during development

---

## IX. Quick Implementation Snippet

```typescript
// Minimal sound controller usage example

// 1. Initialize (in App component)
const soundController = new SoundController(
  soundCache,
  playbackState,
  overrideRules
)

// 2. Preload before session
await soundCache.preloadSounds([
  "kd_bat_dau_choi",
  "kd_hien_cau_hoi",
  "kd_dung",
  "kd_sai",
  "kd_dem_gio_5s",
  "kd_hoan_thanh"
  // ... all sounds from config
])

// 3. In game event handler
switch (event.type) {
  case "ROUND_STARTED":
    // Background loop
    await soundController.play("kd_bat_dau_choi")
    // Delay then question reveal
    setTimeout(() => {
      soundController.play("kd_hien_cau_hoi", {
        onEnd: () => signalQuestionRevealed()
      })
    }, 3000)
    break

  case "TIMER_STARTED":
    await soundController.play("kd_dem_gio_5s")
    break

  case "CORRECT_ANSWER":
    soundController.stop("kd_dem_gio_5s") // Stop timer first
    await soundController.play("kd_dung")
    break

  case "ROUND_ENDED":
    soundController.stopAll()
    await soundController.play("kd_hoan_thanh", {
      onEnd: () => readyForNextRound()
    })
    break
}

// 4. Cleanup
soundController.stopAll()
await soundCache.clearAll()
```

---

**File này được cập nhật cùng với SOUND_ARCHITECTURE.md**

**Dùng file này là "quick start" trong quá trình development.**
