# Hệ Thống Âm Thanh Olympia - Tóm Tắt Thiết Kế

**Phiên bản:** 1.0  
**Ngày:** 2026-01-20  
**Trạng thái:** ✅ DESIGN COMPLETE (Ready for Implementation)

---

## 🎯 Tóm Tắt Nhanh

### Vấn Đề
Olympia cần hệ thống âm thanh chuyên nghiệp để:
- Phát feedback (đúng/sai) theo sự kiện game
- Không overlap âm thanh gây nhiễu
- Tối ưu load time (preload trước)
- Graceful degrade khi lỗi (game vẫn chạy)

### Giải Pháp
3 thành phần chính:
1. **SoundCacheManager**: Preload + cache âm thanh
2. **SoundController**: Play/Stop logic với override rules
3. **SoundEventDispatcher**: Listen game events → trigger sounds

---

## 📚 Tài Liệu

| File | Nội Dung | Mục Đích |
|------|---------|---------|
| **SOUND_ARCHITECTURE.md** | Kiến trúc chi tiết | Hiểu rõ thiết kế |
| **SOUND_QUICK_REFERENCE.md** | Cheat sheet + Priority Matrix | Coding reference |
| **SOUND_IMPLEMENTATION.md** | File structure + steps | Bắt đầu implementation |
| **SOUND_DESIGN_SUMMARY.md** | File này | Quick overview |

---

## 🏗️ Kiến Trúc (Executive Summary)

```
Game Event → SoundEventDispatcher → Override Rules Check → SoundController → Play/Stop
                                            ↓
                                   Check Sound Cache
                                            ↓
                                    Web Audio API
```

### 4 Lớp Chính (Classes)

```typescript
// 1. Cache Manager - Preload & lưu trữ
class SoundCacheManager {
  async preloadSound(soundKey)      // Fetch + decode
  async preloadSounds(soundKeys[])  // Batch preload
  isReady(soundKey): boolean
  getAudioBuffer(soundKey)
  clearAll()
}

// 2. State Manager - Track trạng thái
class PlaybackStateManager {
  setPlaying(soundKey, sourceNode)
  setStopped(soundKey)
  getState(soundKey): { state, currentTime, volume }
  getPlayingKeys(): string[]
}

// 3. Override Rules - Quyết định dừng sound nào
class OverrideRulesEngine {
  getSoundsThatMustStop(soundKeyToPlay): string[]
  canOverride(soundToPlay, currentlyPlaying): boolean
  getPriority(soundKey): number
}

// 4. Controller - Main API
class SoundController {
  async play(soundKey, options?)
  stop(soundKey)
  stopGroup(groupName)
  stopAll()
  pause(soundKey)
  resume(soundKey)
  setVolume(soundKey, volume)
}

// 5. Event Dispatcher - Listen events
class SoundEventDispatcher {
  initialize(eventBus)
  handleGameEvent(eventType, payload)
}
```

---

## 🔊 Event-Sound Mapping (Các vòng)

### Khởi Động (khoi_dong)
```
RoundStart → Play kd_bat_dau_choi (loop)
          ↓
          [Wait 3s]
          ↓
          Play kd_hien_cau_hoi → OnEnd: Show câu
          ↓
TimerStart → Play kd_dem_gio_5s
          ↓
CorrectAnswer → Stop timer + Play kd_dung
              ↓
              [Wait 2s]
              ↓
              Ready next round
```

### VCNV (vcnv)
```
RoundStart → Play vcnv_chon_hang_ngang (select row)
         ↓
         OnEnd → Play vcnv_mo_cau_hoi
         ↓
TimerStart → Play vcnv_dem_gio_15s (auto-stop timer sound)
         ↓
CorrectAnswer → Play vcnv_dung (nếu all scored)
```

### Tăng Tốc (tang_toc)
```
RoundStart → Play tt_mo_cau_hoi
         ↓
TimerStart → IF video: No timer sound
          → ELSE: Play tt_dem_gio_20s/30s
         ↓
RevealAnswer → Play tt_mo_dap_an
            ↓
            [Wait 1s - OVERLAP]
            ↓
            Play vcnv_xem_dap_an (alongside)
```

### Về Đích (ve_dich)
```
RoundStart → Play vd_cac_goi (list packages)
         ↓
SelectCategory → Play vd_lua_chon_goi
            ↓
TimerStart → Play vd_dem_gio_15s/20s
         ↓
CorrectAnswer → Play vd_dung
         ↓
StarRevealed → [PRIORITY MAX] Stop ALL → Play vd_ngoi_sao
```

---

## ⚙️ Override Rules (Khi Phát Sound Gì Sẽ Dừng Sound Nào)

### Rule 1: autoStopWhenOtherPlays = true
```
Nếu sound A có autoStopWhenOtherPlays=true:
  Play A → Stop tất cả khác (trừ background loop)
```

### Rule 2: Background Loop (loop = true)
```
kd_bat_dau_choi (loop) → ONLY stop on:
  • RoundEnded
  • SessionEnded
  • NewRound (vòng khác)
  
KHÔNG stop khi:
  • CorrectAnswer, WrongAnswer
  • Timer start/end
```

### Rule 3: Timer Sound (Countdown Group)
```
Max 1 timer cùng lúc (EXCLUSIVE)
Stop ngay khi:
  • CorrectAnswer → play sound đúng
  • WrongAnswer → play sound sai
  • TimerEnded
```

### Rule 4: Star Sound (Priority MAXIMUM)
```
vd_ngoi_sao → Stop EVERYTHING
           → Play star sound
           → Highest priority
```

### Rule 5: Reveal Answer (Special - Allow Overlap)
```
tt_mo_dap_an + vcnv_xem_dap_an → ALLOW OVERLAP
                                (Both autoStop=false)
```

---

## 📊 Sound Groups (Logical Grouping)

```
BACKGROUND (loop)        → kd_bat_dau_choi
QUESTION_REVEAL         → kd_hien_cau_hoi, vcnv_mo_cau_hoi, tt_mo_cau_hoi, vd_lua_chon_goi
COUNTDOWN (exclusive)   → kd_dem_gio_5s, vcnv_dem_gio_15s, tt_dem_gio_20s, tt_dem_gio_30s, vd_dem_gio_15s, vd_dem_gio_20s
SCORING                 → kd_dung, kd_sai, vcnv_dung, vd_dung, vd_sai, vd_ngoi_sao
INTERACTION             → vcnv_mo_o_chu, vcnv_chon_hang_ngang, vcnv_mo_hinh_anh, tt_mo_dap_an, vd_cac_goi
ROUND_END               → kd_hoan_thanh, vd_hoan_thanh, tong_ket_ket_qua
NOTIFICATION            → chuong
```

---

## 💾 Cache Strategy

### Preload Timing
```
Session Start → Show loading → Batch preload all sounds
             → 5-10 parallel → Show progress
             → Ready for round 1
```

### Preload Strategy
```
Memory-first:
  1. Fetch from Supabase
  2. Decode to AudioBuffer (Web Audio API)
  3. Store in memory
  4. Reuse for play()

Fallback: URL streaming nếu memory limit exceeded
```

### Error Handling
```
404 (file not found):
  → Log warning
  → Mark unavailable
  → Game continues (NO crash)
  → If play() called: Skip sound

Network timeout (10s):
  → Retry 2 times
  → If failed: Mark unavailable

Cache clear: On SessionEnd only
```

---

## 🎮 Integration Points

### 1. useOlympiaGameState.ts
```typescript
// Add:
useSoundEventDispatcher(gameEventBus)

// Dispatcher auto-listens to game events
// Routes to SoundController
```

### 2. Round Components (Example)
```typescript
const { soundController } = useSound()

const handleCorrectAnswer = () => {
  soundController.stop("timer_sound")
  soundController.play("correct_sound")
}
```

### 3. Admin Event Listener
```typescript
// Auto-handled by SoundEventDispatcher
// No special code needed
```

---

## 🚀 Implementation Roadmap

### Phase 1: Foundation (Core Classes)
```
✅ SoundCacheManager
✅ PlaybackStateManager
✅ OverrideRulesEngine
✅ SoundController (integration of above 3)
✅ Helper functions (URL builder, etc.)
```

### Phase 2: Integration
```
→ SoundEventDispatcher (route events to sounds)
→ React hooks (useSound, useSoundEventDispatcher)
→ Integrate with useOlympiaGameState
→ Add to round components
```

### Phase 3: Testing
```
→ Unit tests (cache, rules, controller)
→ Integration tests (full flow)
→ Manual testing (audio quality, timing)
```

### Phase 4: Polish
```
→ Error handling refinement
→ Performance optimization
→ Documentation update
→ Monitoring setup
```

---

## 📍 File Locations

```
NEW FILES TO CREATE:
lib/olympia/sound/
  ├── types.ts
  ├── constants.ts
  ├── soundCacheManager.ts
  ├── playbackStateManager.ts
  ├── overrideRulesEngine.ts
  ├── soundController.ts
  ├── soundEventDispatcher.ts
  └── index.ts

lib/olympia/
  └── olympia-sound-url.ts

hooks/olympia/
  ├── useSound.ts
  └── useSoundEventDispatcher.ts

MODIFY (minimal):
  components/olympia/.../useOlympiaGameState.ts
    → Add useSoundEventDispatcher(eventBus)
  
  components/olympia/.../HostRealtimeEventsListener.tsx
    → Add useSoundEventDispatcher(eventBus)

DOCS (created):
  docs/olympia/
  ├── SOUND_ARCHITECTURE.md
  ├── SOUND_QUICK_REFERENCE.md
  └── SOUND_IMPLEMENTATION.md
```

---

## ⏱️ Timing Reference

```
Round Start → Background (IMMEDIATE)
          ↓
          [3000ms delay]
          ↓
          Question Reveal
          ↓
Correct Answer → Play sound + [2000ms] → Ready next

Reveal Answer (Tăng Tốc):
  tt_mo_dap_an
  ↓
  [1000ms]
  ↓
  vcnv_xem_dap_an (SIMULTANEOUS - allowed overlap)
```

---

## 🔍 Key Assumptions

| Assumption | Reasoning | Impact |
|-----------|-----------|--------|
| Single AudioContext | Minimize resource | ✅ Memory efficient |
| Web Audio API | Native browser support | ✅ No external library |
| Preload before session | Avoid delay during game | ✅ Smooth UX |
| No Service Worker | Simpler implementation | ⚠️ Memory-only cache |
| Fixed Supabase URL | No config changes | ✅ Reliable |
| Event bus exists | Game already has events | ✅ Easy integration |

---

## 🛑 Common Pitfalls to Avoid

```
❌ DO NOT:
  1. Hardcode URL → Use buildSoundUrl()
  2. Create multiple AudioContext → Use singleton
  3. Assume cached → Always check isReady()
  4. Modify config JSON → Read-only
  5. Play without cache check → Will fail
  6. Forget stop timer on correct → Sound overlap

✅ DO:
  1. Use constants from config
  2. Log with context (soundKey, event)
  3. Test edge cases (spam, pause)
  4. Handle preload errors gracefully
  5. Cleanup on unmount
  6. Verify timing with actual flow
```

---

## 📋 Checklist Before Implementation

- [ ] Read SOUND_ARCHITECTURE.md (full design)
- [ ] Review olympia-sound-config.json
- [ ] Understand override rules (Section V of arch doc)
- [ ] Check Web Audio API basics
- [ ] Verify Supabase URL format
- [ ] Review event system (realtime-guard.ts)
- [ ] Plan test cases
- [ ] Setup dev environment

---

## 📞 Reference Documents

| Document | When to Read | Content |
|----------|-------------|---------|
| **SOUND_ARCHITECTURE.md** | Before coding | Full technical design |
| **SOUND_QUICK_REFERENCE.md** | During coding | Priority matrix, cheat sheet |
| **SOUND_IMPLEMENTATION.md** | During setup | File structure, integration |
| **SOUND_DESIGN_SUMMARY.md** | First time | This file - overview |

---

## 🎬 Next Steps

1. **Read** → Full SOUND_ARCHITECTURE.md
2. **Understand** → Override rules & event mapping
3. **Plan** → Test cases & integration points
4. **Implement** → Phase 1 (foundation) first
5. **Test** → Unit + integration tests
6. **Integrate** → Add to useOlympiaGameState
7. **Validate** → Manual testing with real game

---

## 📝 Version History

| Version | Date | Status | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-20 | ✅ COMPLETE | Initial design |

---

**🎯 Design is READY for implementation.**

**📚 Read SOUND_ARCHITECTURE.md for full details.**

**✨ Implementation starts with Phase 1 (Foundation).**
