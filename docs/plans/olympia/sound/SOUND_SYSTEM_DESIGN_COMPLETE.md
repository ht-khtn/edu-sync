# ✅ Hệ Thống Âm Thanh Olympia - DESIGN COMPLETE

**Ngày:** 2026-01-20  
**Trạng thái:** ✅ READY FOR IMPLEMENTATION  
**Version:** 1.0

---

## 📚 Tài Liệu Đã Tạo

Tất cả tài liệu thiết kế hoàn chỉnh được lưu tại: **`docs/plans/olympia/sound/`**

### Files Chính (Quan trọng - Đọc theo thứ tự)

1. ✅ **[SOUND_DESIGN_SUMMARY.md](SOUND_DESIGN_SUMMARY.md)** (5-10 min)
   - Overview nhanh gọn
   - Tóm tắt kiến trúc
   - Event-sound mapping cơ bản
   - Khi nào phát sound gì

2. ✅ **[SOUND_ARCHITECTURE.md](SOUND_ARCHITECTURE.md)** (30-45 min - **BẮCBUỘC ĐỌC**)
   - Chi tiết 14 section
   - Config analysis
   - 4 classes chính (SoundController, Cache, State, Rules)
   - Event-sound mapping ĐẦY ĐỦ cho 4 vòng thi
   - Override rules logic
   - Cache strategy
   - Pseudo-code
   - Error handling & edge cases

3. ✅ **[SOUND_QUICK_REFERENCE.md](SOUND_QUICK_REFERENCE.md)** (Quick lookup)
   - Priority Matrix (tất cả scenarios)
   - Override Decision Tree
   - State Transition Diagram
   - Timing Constants
   - FAQ & Troubleshooting
   - Common Pitfalls

4. ✅ **[SOUND_IMPLEMENTATION.md](SOUND_IMPLEMENTATION.md)** (15-20 min)
   - File structure & locations
   - Từng file descriptions + dependencies
   - Integration points (chỉ sửa 2 files hiện có)
   - File creation order (Phase 1, 2, 3, 4)
   - Type imports pattern
   - Git commit strategy
   - Pre-implementation checklist

5. ✅ **[SOUND_TESTING_STRATEGY.md](SOUND_TESTING_STRATEGY.md)** (20-30 min)
   - Unit tests (70%)
   - Integration tests (20%)
   - E2E tests (10%)
   - Chi tiết test cases
   - Mock & fixtures
   - Coverage goals (85%+)

6. ✅ **[README.md](README.md)** (Index & navigation)
   - Quick lookup map
   - Learning paths (Level 1-4)
   - Document matrix
   - Cross-references

---

## 🏗️ Kiến Trúc Tóm Tắt

### 3 Thành Phần Chính

```
┌─────────────────────────────────────┐
│   SoundCacheManager                 │
│ - Preload sounds từ Supabase        │
│ - Decode AudioBuffer                │
│ - Track loaded/failed               │
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│   SoundController                   │
│ - Main API: play(), stop()          │
│ - Apply override rules              │
│ - Update playback state             │
└─────────────────────────────────────┘
           ↑
┌─────────────────────────────────────┐
│   SoundEventDispatcher              │
│ - Listen game events                │
│ - Route to SoundController          │
│ - Handle timing & sequencing        │
└─────────────────────────────────────┘
```

### 4 Lớp Hỗ Trợ

- **PlaybackStateManager:** Track state (playing/paused/stopped)
- **OverrideRulesEngine:** Quyết định dừng sound nào
- Helper functions: URL builder, sound config loader
- React hooks: useSound, useSoundEventDispatcher

---

## 🔊 Event-Sound Mapping (4 Vòng)

### Khởi Động (khoi_dong)

- **Start:** Play `kd_bat_dau_choi` (loop)
- **+3s:** Play `kd_hien_cau_hoi` → Signal UI show question
- **Timer:** Play `kd_dem_gio_5s` (countdown)
- **Correct:** Stop timer → Play `kd_dung` (override)
- **Wrong:** Play `kd_sai` (override timer)
- **End:** Stop all → Play `kd_hoan_thanh`

### VCNV

- **Start:** Play `vcnv_chon_hang_ngang` (select row)
- **+OnEnd:** Play `vcnv_mo_cau_hoi` → Show question
- **Timer:** Play `vcnv_dem_gio_15s`
- **Correct:** Play `vcnv_dung` (nếu all scored)
- **Interactions:** `vcnv_mo_o_chu`, `vcnv_mo_hinh_anh`

### Tăng Tốc (tang_toc)

- **Start:** Play `tt_mo_cau_hoi`
- **Timer:** IF video → NO timer sound / ELSE → `tt_dem_gio_20s` or `30s`
- **Reveal Answer:** Play `tt_mo_dap_an` + [1s] → `vcnv_xem_dap_an` (OVERLAP allowed)
- **Correct/Wrong:** Play `vd_dung` / `vd_sai`

### Về Đích (ve_dich)

- **Start:** Play `vd_cac_goi` (danh sách gói)
- **Select:** Play `vd_lua_chon_goi`
- **Timer:** Play `vd_dem_gio_15s` or `20s`
- **Star:** ⭐ Stop ALL → Play `vd_ngoi_sao` (PRIORITY MAX)
- **Correct/Wrong:** Play `vd_dung` / `vd_sai`
- **End:** Play `vd_hoan_thanh`

---

## ⚙️ Override Rules (Khi phát sound gì sẽ dừng sound nào)

| Rule                            | Khi Play                                  | Dừng Sound        | Ngoại Lệ              |
| ------------------------------- | ----------------------------------------- | ----------------- | --------------------- |
| **autoStopWhenOtherPlays=true** | `kd_dung`, `vd_dung`, `vd_ngoi_sao`, etc. | Tất cả khác       | Background loop       |
| **Background Loop**             | `kd_bat_dau_choi`                         | -                 | CHỈ dừng on RoundEnd  |
| **Timer (Countdown)**           | All timers                                | Exclusive (max 1) | Stop on CorrectAnswer |
| **Star Sound**                  | `vd_ngoi_sao`                             | EVERYTHING        | Priority MAX          |
| **Reveal Answer**               | `tt_mo_dap_an` + `vcnv_xem_dap_an`        | ALLOW OVERLAP     | Special case          |

---

## 💾 Cache Strategy

### Preload Timing

```
Session Start (Vào thi)
  → Show loading screen
  → Batch load 5-10 sounds parallel
  → Show progress bar
  → Ready for round 1
```

### Error Handling

```
404 (File not found)     → Log warning + mark unavailable + continue
Network timeout (10s)    → Retry 2 times + mark failed + continue
Memory exceeded (100MB)  → Fallback to URL streaming
```

**Policy:** Graceful degradation - Game tiếp tục chạy dù âm thanh lỗi

---

## 📋 Implementation Phases

### Phase 1: Foundation (Core Classes)

```
✅ SoundCacheManager       → Preload & cache
✅ PlaybackStateManager    → Track state
✅ OverrideRulesEngine     → Rules logic
✅ SoundController         → Main API
```

### Phase 2: Integration

```
→ SoundEventDispatcher    → Listen events
→ React hooks             → useSound, useSoundEventDispatcher
→ Integrate with game    → Add to useOlympiaGameState
```

### Phase 3: Testing

```
→ Unit tests (70%)
→ Integration tests (20%)
→ E2E tests (10%)
```

### Phase 4: Polish

```
→ Error handling refinement
→ Performance optimization
→ Monitoring setup
```

---

## 📁 File Locations to Create

```
NEW FILES:
lib/olympia/sound/
  ├── types.ts                    [TypeScript interfaces]
  ├── constants.ts                [Timing, batch size, etc.]
  ├── soundCacheManager.ts        [Preload & cache]
  ├── playbackStateManager.ts     [State tracking]
  ├── overrideRulesEngine.ts      [Override rules]
  ├── soundController.ts          [Main API]
  ├── soundEventDispatcher.ts     [Event handling]
  └── index.ts                    [Barrel export]

lib/olympia/
  └── olympia-sound-url.ts        [URL builder]

hooks/olympia/
  ├── useSound.ts                 [React hook]
  └── useSoundEventDispatcher.ts  [Event dispatcher hook]

MODIFY (minimal):
  components/olympia/shared/game/useOlympiaGameState.ts
    → Add: useSoundEventDispatcher(eventBus)

  components/olympia/admin/matches/HostRealtimeEventsListener.tsx
    → Add: useSoundEventDispatcher(eventBus)
```

---

## 🎯 Key Assumptions

| Assumption           | Impact                 |
| -------------------- | ---------------------- |
| Single AudioContext  | ✅ Memory efficient    |
| Web Audio API native | ✅ No external library |
| Preload before game  | ✅ Smooth playback     |
| Event bus exists     | ✅ Easy to integrate   |
| Fixed Supabase URL   | ✅ No config needed    |
| Memory-only cache    | ✅ Simple, fast        |

---

## ✅ Pre-Implementation Checklist

- [ ] Read SOUND_DESIGN_SUMMARY.md (understand overview)
- [ ] Read SOUND_ARCHITECTURE.md (understand design)
- [ ] Review olympia-sound-config.json (understand sounds)
- [ ] Check Web Audio API basics
- [ ] Verify Supabase URL format works
- [ ] Review realtime-guard.ts (understand events)
- [ ] Plan test cases
- [ ] Setup dev environment

---

## 🚀 Next Step

**➡️ Read:** `docs/plans/olympia/sound/SOUND_ARCHITECTURE.md` (Full design)  
**➡️ Understand:** Event-Sound mapping (Section V)  
**➡️ Plan:** File structure (SOUND_IMPLEMENTATION.md)  
**➡️ Code:** Phase 1 - Foundation (SoundCacheManager, PlaybackState, OverrideRules, SoundController)  
**➡️ Test:** Write unit tests (SOUND_TESTING_STRATEGY.md)  
**➡️ Integrate:** Phase 2 - Add to game flow  
**➡️ Validate:** Manual testing with real Olympia session

---

## 📞 Documentation Quick Links

| Need           | Document                  | Section         |
| -------------- | ------------------------- | --------------- |
| Quick overview | SOUND_DESIGN_SUMMARY.md   | Tất cả          |
| Full design    | SOUND_ARCHITECTURE.md     | Tất cả          |
| While coding   | SOUND_QUICK_REFERENCE.md  | Priority Matrix |
| File locations | SOUND_IMPLEMENTATION.md   | II-VI           |
| Test strategy  | SOUND_TESTING_STRATEGY.md | II-IV           |
| Navigation     | README.md                 | Tất cả          |

---

## 🎓 Learning Time

| Task                        | Time      |
| --------------------------- | --------- |
| Read SOUND_DESIGN_SUMMARY   | 5-10 min  |
| Read SOUND_ARCHITECTURE     | 30-45 min |
| Understand override rules   | 15 min    |
| Review SOUND_IMPLEMENTATION | 10-15 min |
| Plan Phase 1                | 10-15 min |
| **Total before coding:**    | ~2 hours  |

---

## 🏁 Summary

✅ **COMPLETE DESIGN DELIVERED:**

- 5 comprehensive documents
- 4 vòng thi mapped (Khởi Động, VCNV, Tăng Tốc, Về Đích)
- Override rules engine designed
- Cache strategy defined
- Pseudo-code provided
- Test strategy included
- Implementation roadmap clear

✅ **NO CODE WRITTEN YET:**

- This is DESIGN PHASE only
- Ready for implementation
- All pseudo-code & logic documented

✅ **NEXT: IMPLEMENTATION PHASE**

- Start with Phase 1 (Foundation)
- Follow SOUND_IMPLEMENTATION.md steps
- Use SOUND_QUICK_REFERENCE.md while coding
- Write tests from SOUND_TESTING_STRATEGY.md

---

**🎉 Design is complete and ready for implementation!**

**📚 Start reading: `docs/plans/olympia/sound/SOUND_DESIGN_SUMMARY.md`**

---

_Generated: 2026-01-20_  
_Version: 1.0 - Design Complete_
