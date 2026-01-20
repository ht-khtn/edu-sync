# Kiến Trúc Hệ Thống Âm Thanh Olympia

**Phiên bản:** 1.0  
**Cập nhật:** 2026-01-20  
**Trạng thái:** DESIGN PHASE (Không có implementation code)

---

## I. Tổng Quan

### Mục Tiêu
Thiết kế hệ thống quản lý âm thanh cho ứng dụng thi Olympia với các nguyên tắc:
- **Không overlap**: Âm thanh không được chồng lên nhau gây nhiễu (trừ các trường hợp đặc biệt)
- **State-driven**: Phát âm thanh dựa trên trạng thái game, không dự đoán tùy tiện
- **Cache-first**: Preload âm thanh trước khi cần, tránh delay khi phát
- **Graceful degradation**: Nếu âm thanh lỗi, game vẫn chạy bình thường

### Scope
- ✅ Logic phát/dừng âm thanh
- ✅ Quản lý trạng thái phát (playing, paused, stopped)
- ✅ Override rules & priority
- ✅ Cache strategy & preload
- ✅ Error handling & fallback
- ❌ Asset management (mp3 files)
- ❌ Chỉnh sửa olympia-sound-config.json
- ❌ UI/UX audio player

---

## II. Config Âm Thanh Hiện Có

### Vị Trí
`lib/olympia/olympia-sound-config.json`

### Cấu Trúc
```json
{
  "meta": {
    "default": {
      "autoStopWhenOtherPlays": false,
      "loop": false,
      "volume": 1.0
    }
  },
  "sounds": {
    "soundKey": {
      "file": "fileName",
      "autoStopWhenOtherPlays": boolean,
      "loop": boolean,
      "volume": number
    }
  }
}
```

### Nhóm Âm Thanh Theo Vòng

#### **Vòng Khởi Động (khoi_dong)**
| Sound Key | File | Auto Stop | Loop | Mục Đích |
|-----------|------|-----------|------|---------|
| `kd_bat_dau_choi` | 1 bat dau choi | ✗ | ✓ | Nền vòng khởi động |
| `kd_hien_cau_hoi` | 1 hien cau hoi | ✗ | ✗ | Mở câu hỏi |
| `kd_dung` | 1 tra loi dung | ✓ | ✗ | Trả lời đúng |
| `kd_sai` | 1 tra loi sai | ✓ | ✗ | Trả lời sai |
| `kd_dem_gio_5s` | 4 5s | ✓ | ✗ | Đếm giờ 5s |
| `kd_hoan_thanh` | 1 hoan thanh | ✓ | ✗ | Kết thúc vòng |

#### **VCNV (vcnv)**
| Sound Key | File | Auto Stop | Loop | Mục Đích |
|-----------|------|-----------|------|---------|
| `vcnv_mo_o_chu` | 2 mo o chu | ✓ | ✗ | Mở ô chữ |
| `vcnv_chon_hang_ngang` | 2 chon hang ngang (new) | ✓ | ✗ | Chọn hàng ngang |
| `vcnv_mo_cau_hoi` | 2 mo cau hoi | ✗ | ✗ | Mở câu hỏi |
| `vcnv_dem_gio_15s` | 2 15s | ✓ | ✗ | Đếm giờ 15s |
| `vcnv_xem_dap_an` | 2 xem dap an | ✗ | ✗ | Xem đáp án |
| `vcnv_dung` | 2 tra loi dung(moi) | ✓ | ✗ | Trả lời đúng |
| `vcnv_mo_hinh_anh` | 2 mo hinh anh | ✓ | ✗ | Mở hình ảnh |

#### **Tăng Tốc (tang_toc)**
| Sound Key | File | Auto Stop | Loop | Mục Đích |
|-----------|------|-----------|------|---------|
| `tt_mo_cau_hoi` | 3 mo cau hoi | ✓ | ✗ | Mở câu hỏi |
| `tt_dem_gio_20s` | 3 20s | ✓ | ✗ | Đếm giờ 20s |
| `tt_dem_gio_30s` | 3 30s | ✓ | ✗ | Đếm giờ 30s |
| `tt_mo_dap_an` | 3 mo dap an | ✗ | ✗ | Mở đáp án |

#### **Về Đích (ve_dich)**
| Sound Key | File | Auto Stop | Loop | Mục Đích |
|-----------|------|-----------|------|---------|
| `vd_bat_dau_choi` | 4 bat dau choi | ✓ | ✗ | Bắt đầu vòng |
| `vd_cac_goi` | 4 cac goi cau hoi | ✓ | ✗ | Danh sách gói câu hỏi |
| `vd_lua_chon_goi` | 4 lua chon goi cau hoi | ✗ | ✗ | Chọn gói |
| `vd_dung` | 4 tra loi dung | ✓ | ✗ | Trả lời đúng |
| `vd_sai` | 4 tra loi sai | ✓ | ✗ | Trả lời sai |
| `vd_ngoi_sao` | ngoi sao hi vong | ✓ | ✗ | Ngôi sao hi vọng |
| `vd_hoan_thanh` | 4 hoan thanh | ✓ | ✗ | Kết thúc vòng |
| `vd_dem_gio_15s` | 4 15s | ✓ | ✗ | Đếm giờ 15s |
| `vd_dem_gio_20s` | 4 20s | ✓ | ✗ | Đếm giờ 20s |

#### **Chung**
| Sound Key | File | Auto Stop | Loop | Mục Đích |
|-----------|------|-----------|------|---------|
| `tong_ket_diem` | tong ket diem | ✓ | ✗ | Tổng kết điểm |
| `chuong` | 4 chuong | ✗ | ✗ | Chuông (thông báo) |
| `tong_ket_ket_qua` | tongketketqua | ✓ | ✗ | Tổng kết kết quả |

---

## III. Kiến Trúc Sound Controller

### 3.1 Thành Phần Chính

```
┌─────────────────────────────────────────────────────┐
│                    Game Events                      │
│  (RoundStart, QuestionShow, TimerTick, etc.)       │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│              SoundEventDispatcher                   │
│  - Listen game events                              │
│  - Map event → sound action                        │
│  - Route to SoundController                        │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│              SoundController                        │
│  - Execute play/stop commands                      │
│  - Apply override rules                            │
│  - Manage playback state                           │
│  - Query SoundCacheManager                         │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌──────────────┬────────────────────┬────────────────┐
│              │                    │                │
▼              ▼                    ▼                ▼
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│SoundCache│ │PlaybackState│ │OverrideRules
│Manager   │ │Manager   │ │Engine   │ │Queue    │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
```

### 3.2 Các Lớp (Classes)

#### **SoundCacheManager**
**Mục đích:** Quản lý preload và cache âm thanh

**Trách nhiệm:**
- Preload sound từ Supabase Storage
- Lưu trữ AudioBuffer trong memory
- Kiểm tra trạng thái ready của sound
- Xử lý lỗi load

**Public Interface:**
```
class SoundCacheManager {
  // Preload sound từ config key
  async preloadSound(soundKey: string): Promise<void>
  
  // Preload nhiều sound cùng lúc
  async preloadSounds(soundKeys: string[]): Promise<{
    loaded: string[],
    failed: string[]
  }>
  
  // Kiểm tra sound đã ready
  isReady(soundKey: string): boolean
  
  // Lấy AudioBuffer của sound
  getAudioBuffer(soundKey: string): AudioBuffer | null
  
  // Clear cache của sound (nếu cần)
  clearSound(soundKey: string): void
  
  // Clear toàn bộ cache
  clearAll(): void
  
  // Lấy status: { loaded, failed, pending }
  getStatus(): { loaded: string[], failed: string[], pending: string[] }
}
```

**Internal State:**
```
{
  cache: Map<soundKey, AudioBuffer>,
  loadingPromises: Map<soundKey, Promise>,
  failed: Set<soundKey>,
  config: olympia-sound-config
}
```

---

#### **PlaybackStateManager**
**Mục đích:** Theo dõi trạng thái phát của từng sound

**Trách nhiệm:**
- Lưu trạng thái: playing, paused, stopped
- Lưu metadata: startTime, duration, volume
- Lưu reference đến AudioContext/Source
- Xử lý state transition

**Public Interface:**
```
class PlaybackStateManager {
  // Bắt đầu phát sound
  setPlaying(soundKey: string, sourceNode: AudioBufferSourceNode): void
  
  // Dừng phát (pause)
  setPaused(soundKey: string): void
  
  // Dừng phát (complete)
  setStopped(soundKey: string): void
  
  // Lấy trạng thái hiện tại
  getState(soundKey: string): {
    state: "playing" | "paused" | "stopped",
    startTime?: number,
    sourceNode?: AudioBufferSourceNode
  }
  
  // Lấy danh sách sound đang phát
  getPlayingKeys(): string[]
  
  // Kiểm tra sound đang phát
  isPlaying(soundKey: string): boolean
  
  // Clear toàn bộ state
  clearAll(): void
}
```

---

#### **OverrideRulesEngine**
**Mục đích:** Định nghĩa & thực thi quy tắc override âm thanh

**Trách nhiệm:**
- Kiểm tra quy tắc override khi play sound mới
- Xác định sound nào phải dừng
- Xác định priority của sound

**Public Interface:**
```
class OverrideRulesEngine {
  // Xác định sound nào phải dừng khi play soundKey mới
  getSoundsThatMustStop(soundKey: string): string[]
  
  // Kiểm tra sound này có override được không
  canOverride(soundKeyToPlay: string, currentlyPlayingSoundKey: string): boolean
  
  // Lấy priority của sound (cao = phát trước)
  getPriority(soundKey: string): number
  
  // Lấy danh sách sound trong cùng group
  getSoundGroup(soundKey: string): string[]
}
```

**Override Rules:**
(Chi tiết ở phần V)

---

#### **SoundController**
**Mục đích:** API chính để phát/dừng âm thanh

**Trách nhiệm:**
- Execute play/stop commands
- Apply override rules
- Manage queue & delay
- Logging & error handling

**Public Interface:**
```
class SoundController {
  // Phát sound ngay lập tức (sau khi checked cache)
  async play(soundKey: string, options?: {
    delay?: number,      // ms - delay trước khi phát
    onEnd?: () => void,  // callback khi kết thúc
    forceOverride?: boolean
  }): Promise<{ success: boolean, error?: string }>
  
  // Dừng sound
  stop(soundKey: string): void
  
  // Dừng tất cả sound trong group
  stopGroup(groupName: string): void
  
  // Dừng tất cả sound
  stopAll(): void
  
  // Pause sound (tạm dừng, có thể resume)
  pause(soundKey: string): void
  
  // Resume sound từ pause
  resume(soundKey: string): void
  
  // Cài đặt volume
  setVolume(soundKey: string, volume: number): void
  
  // Lấy trạng thái phát của sound
  getState(soundKey: string): {
    state: "playing" | "paused" | "stopped",
    currentTime?: number,
    volume?: number
  }
  
  // Check nếu sound đã ready trong cache
  isCached(soundKey: string): boolean
}
```

---

#### **SoundEventDispatcher**
**Mục đích:** Lắng nghe game event và trigger sound play/stop

**Trách nhiệm:**
- Subscribe game state changes
- Map events → sound actions
- Route commands đến SoundController
- Handle timing & sequencing

**Public Interface:**
```
class SoundEventDispatcher {
  // Initialize & subscribe to game events
  initialize(gameEventBus: EventBus): void
  
  // Giải phóng resources
  destroy(): void
  
  // Xử lý single event
  handleGameEvent(eventType: string, payload: any): Promise<void>
}
```

---

### 3.3 Sound Groups (Logical Grouping)

```
├── BACKGROUND (Nền vòng, có thể loop)
│   ├── kd_bat_dau_choi (loop)
│   └── [Các vòng khác có nền riêng]
│
├── QUESTION_REVEAL (Mở câu hỏi)
│   ├── kd_hien_cau_hoi
│   ├── vcnv_mo_cau_hoi
│   ├── tt_mo_cau_hoi
│   └── vd_lua_chon_goi
│
├── SCORING (Chấm điểm)
│   ├── kd_dung, kd_sai
│   ├── vcnv_dung
│   ├── vd_dung, vd_sai
│   ├── vd_ngoi_sao
│   └── tong_ket_diem
│
├── COUNTDOWN (Đếm giờ)
│   ├── kd_dem_gio_5s
│   ├── vcnv_dem_gio_15s
│   ├── tt_dem_gio_20s, tt_dem_gio_30s
│   ├── vd_dem_gio_15s, vd_dem_gio_20s
│   └── [Chỉ phát 1 lúc]
│
├── ROUND_END (Kết thúc vòng)
│   ├── kd_hoan_thanh
│   ├── vd_hoan_thanh
│   └── tong_ket_ket_qua
│
├── INTERACTION (Tương tác trực tiếp)
│   ├── vcnv_mo_o_chu
│   ├── vcnv_chon_hang_ngang
│   ├── vcnv_mo_hinh_anh
│   ├── tt_mo_dap_an
│   └── vd_cac_goi
│
└── NOTIFICATION (Thông báo)
    └── chuong
```

---

## IV. Sound URL Builder

### 4.1 Quy Tắc URL

**Public URL Format (FIXED):**
```
https://fbxrlpiigoviphaxmstd.supabase.co/storage/v1/object/public/olympia/Olympia%20Sound/{fileName}.mp3
```

**Encoding Rule:**
- Space → %20
- KHÔNG thêm `.mp3` nếu `fileName` đã có
- `fileName` lấy từ config trực tiếp

### 4.2 Helper Function

```typescript
// Location: lib/olympia/olympia-sound-url.ts

function buildSoundUrl(fileName: string): string {
  const baseUrl = "https://fbxrlpiigoviphaxmstd.supabase.co/storage/v1/object/public/olympia/Olympia%20Sound";
  // Replace space với %20
  const encodedFileName = fileName.replace(/ /g, "%20");
  return `${baseUrl}/${encodedFileName}.mp3`;
}

// Lấy fileName từ config
function getSoundFileName(soundKey: string): string | null {
  const config = loadOlympiaSoundConfig();
  return config.sounds[soundKey]?.file || null;
}

// Lấy full URL từ soundKey
function getSoundUrl(soundKey: string): string | null {
  const fileName = getSoundFileName(soundKey);
  if (!fileName) return null;
  return buildSoundUrl(fileName);
}
```

**KHÔNG hardcode URL trong logic**  
**Luôn gọi helper `buildSoundUrl()` hoặc `getSoundUrl()`**

---

## V. Event-Sound Mapping & Override Rules

### 5.1 Game Events → Sound Actions

#### **Event: RoundStarted**
```
Trigger khi: Admin bất đầu vòng (khoi_dong, vcnv, tang_toc, ve_dich)

Vòng Khởi Động (khoi_dong):
  1. Stop: Tất cả sound đang phát (trừ notification)
  2. Play: kd_bat_dau_choi (loop=true)
  3. Wait: 3s (hoặc configurable)
  4. Play: kd_hien_cau_hoi
  5. Wait: sound kd_hien_cau_hoi kết thúc
  6. Trigger: QuestionRevealed (UI show câu)

VCNV (vcnv):
  1. Stop: Tất cả sound background
  2. Play: vcnv_chon_hang_ngang (nếu mode chọn hàng)
  3. Wait: sound kết thúc
  4. Play: vcnv_mo_cau_hoi
  5. Wait: sound kết thúc
  6. Trigger: QuestionRevealed

Tăng Tốc (tang_toc):
  1. Stop: Tất cả sound background
  2. Play: tt_mo_cau_hoi
  3. Wait: sound kết thúc
  4. Trigger: QuestionRevealed
  [Nếu question có video: KHÔNG play timer]

Về Đích (ve_dich):
  1. Stop: Tất cả sound background
  2. Play: vd_bat_dau_choi (nếu có)
  3. Wait: N/A
  4. Play: vd_cac_goi (danh sách gói câu)
  5. Wait: Player chọn gói
```

#### **Event: QuestionRevealed (UI show câu hỏi)**
```
Trigger khi: Sau sound mở câu hỏi kết thúc

Action: KHÔNG play sound thêm (câu hỏi đã shown)
```

#### **Event: TimerStarted**
```
Trigger khi: Bắt đầu đếm giờ

Quy tắc chọn sound đếm:
- Vòng khởi động (kd): play kd_dem_gio_5s
- VCNV (vcnv): play vcnv_dem_gio_15s
- Tăng tốc (tang_toc): 
  - Nếu câu có video: KHÔNG play sound (video start ≈ timer start)
  - Nếu câu text: play tt_dem_gio_20s hoặc tt_dem_gio_30s (tuỳ duration)
- Về đích (vd): play vd_dem_gio_15s hoặc vd_dem_gio_20s

Override: Nếu play CorrectAnswer hoặc WrongAnswer → stop timer ngay
```

#### **Event: CorrectAnswer**
```
Trigger khi: Admin/System chấm đúng cho thí sinh

Action:
1. Stop: Timer sound ngay
2. Stop: Background sound (nếu có)
3. Play: Sound đúng của vòng đó (với autoStopWhenOtherPlays=true)
4. Delay: 2s
5. Play: Sound kết thúc vòng (nếu tất cả thí sinh đã chấm)

Sound theo vòng:
- khoi_dong: kd_dung
- vcnv: vcnv_dung (chỉ nếu ĐÃ chấm toàn bộ)
- tang_toc: (không có sound đúng riêng)
- ve_dich: vd_dung
```

#### **Event: WrongAnswer**
```
Trigger khi: Admin/System chấm sai cho thí sinh

Action:
1. Stop: Timer sound ngay
2. Play: Sound sai của vòng đó (với autoStopWhenOtherPlays=true)
3. Delay: 2s
4. Resume: Timer sound (nếu vẫn còn giờ)
  HOẶC
4. Play: Round end sound (nếu hết thí sinh)

Sound theo vòng:
- khoi_dong: kd_sai
- vcnv: (không có sound sai)
- tang_toc: (không có sound sai)
- ve_dich: vd_sai
```

#### **Event: TimerEnded**
```
Trigger khi: Timer hết giờ

Action:
1. Stop: Timer sound
2. Stop: Question reveal sound
3. Play: Sound thích hợp tuỳ vòng (nếu có)
```

#### **Event: RoundEnded**
```
Trigger khi: Admin bấm "Kết thúc vòng"

Action:
1. Stop: Tất cả sound đang phát
2. Play: Sound kết thúc vòng
   - khoi_dong: kd_hoan_thanh
   - vcnv: (tuỳ logic)
   - tang_toc: (tuỳ logic)
   - ve_dich: vd_hoan_thanh
3. Wait: Sound kết thúc
4. Transition: Sẵn sàng cho vòng kế tiếp
```

#### **Event: RevealAnswer (Tăng Tốc - Mở Đáp Án)**
```
Trigger khi: Admin mở đáp án ở vòng Tăng Tốc

Action:
1. Stop: Timer sound (nếu đang phát)
2. Play: tt_mo_dap_an (không auto-stop)
3. Wait: ~1s
4. Play: vcnv_xem_dap_an (không auto-stop, lồng với sound trên)
   [Hai sound này ĐƯỢC phép overlap → tạo effect]
```

#### **Event: StarRevealed (Về Đích - Ngôi Sao)**
```
Trigger khi: Ngôi sao hi vọng được mở

Action:
1. Stop: Tất cả sound (priority cao)
2. Play: vd_ngoi_sao (autoStopWhenOtherPlays=true)
3. Wait: Sound kết thúc
```

#### **Event: SelectRowCNV (VCNV - Chọn Hàng Ngang)**
```
Trigger khi: Thí sinh chọn hàng ngang ở VCNV

Action:
1. Play: vcnv_chon_hang_ngang (autoStopWhenOtherPlays=true)
2. Wait: Sound kết thúc
3. Trigger: Show câu hỏi + play vcnv_mo_cau_hoi
```

#### **Event: SelectCategory (Về Đích - Chọn Gói)**
```
Trigger khi: Thí sinh chọn gói câu ở Về Đích

Action:
1. Play: vd_lua_chon_goi
2. Wait: Sound kết thúc
3. Trigger: Play timer sound
```

#### **Event: SessionEnded**
```
Trigger khi: Kết thúc phiên thi (toàn bộ Olympia)

Action:
1. Stop: Tất cả sound
2. Play: tong_ket_ket_qua (nếu cần)
3. Wait: Sound kết thúc
4. Clear: Cache âm thanh
5. Disconnect: AudioContext
```

---

### 5.2 Override Rules (Chi Tiết)

#### **Rule 1: Sound có autoStopWhenOtherPlays=true**
```
Nếu sound A có autoStopWhenOtherPlays=true:
  Khi play A → Stop tất cả sound hiện đang phát (trừ loop background)
  
Ví dụ: Play kd_dung (correct answer)
  → Stop: kd_dem_gio_5s (timer)
  → Stop: Các sound phát trước đó
  → KHÔNG stop: kd_bat_dau_choi (nếu nó là background loop)

Ngoại lệ: Timer sound (kd_dem_gio_5s, vcnv_dem_gio_15s, v.v.)
  → Luôn dừng khi: CorrectAnswer, WrongAnswer, TimerEnded
  → KHÔNG dừng khi: RevealQuestion (mở câu hỏi)
```

#### **Rule 2: Background Loop (nền vòng)**
```
Sound loop (loop=true):
  - kd_bat_dau_choi
  - (Các vòng khác có nền riêng: tạo entry tương tự)

Quy tắc:
  1. Chỉ dừng khi:
     - RoundEnded (kết thúc vòng)
     - SessionEnded (kết thúc thi)
     - NewRound started (vòng mới → stop vòng cũ)
  
  2. KHÔNG dừng khi:
     - CorrectAnswer, WrongAnswer (phát sound chấm CÙNG lúc)
     - TimerStarted, TimerEnded
     - RevealAnswer (Tăng tốc)

Vì sao: Nền vòng tạo bầu không khí, không ảnh hưởng feedback
```

#### **Rule 3: Timer Sound (Countdown)**
```
Sound đếm giờ:
  - kd_dem_gio_5s, vcnv_dem_gio_15s, v.v.

Quy tắc:
  1. Chỉ phát 1 timer cùng lúc (KHÔNG overlap timers)
  2. Stop timer ngay khi:
     - CorrectAnswer được phát
     - WrongAnswer được phát
     - TimerEnded
  
  3. KHÔNG dừng timer khi:
     - Play background (nền vòng)
     - Play question reveal
```

#### **Rule 4: Correct/Wrong Answer Sound (Chấm Điểm)**
```
Sound chấm điểm:
  - kd_dung, kd_sai, vcnv_dung, vd_dung, vd_sai, v.v.

Quy tắc (autoStopWhenOtherPlays=true):
  1. Play kd_dung:
     → Stop: Timer, Background (optional tuỳ vòng)
     → KHÔNG stop: Question reveal sound
  
  2. Play kd_sai:
     → Stop: Timer
     → KHÔNG stop: Background
  
  3. Chỉ phát sound chấm khi:
     - Admin bấm chấm (không phát khi thí sinh submit)
     - Tuỳ vòng có sound hay không (VCNV & Tăng tốc không có sai)
  
  4. Delay trước phát sound kế tiếp:
     - Nếu phát CorrectAnswer: wait 2-3s rồi mới play end-round
     - Nếu phát WrongAnswer: wait 2s rồi resume timer
```

#### **Rule 5: Star Sound (Về Đích - Ngôi Sao)**
```
Sound: vd_ngoi_sao (autoStopWhenOtherPlays=true)

Quy tắc:
  1. Priority CAO nhất (chỉ sau Star reveal event)
  2. Stop: Tất cả sound (bao gồm timer, background)
  3. Play: vd_ngoi_sao
  4. KHÔNG overlap với sound khác
  5. Callback: Khi end → Resume game flow
```

#### **Rule 6: Reveal Answer Sound (Tăng Tốc)**
```
Sound: tt_mo_dap_an (autoStopWhenOtherPlays=false)
Sound: vcnv_xem_dap_an (autoStopWhenOtherPlays=false)

Quy tắc:
  1. Play tt_mo_dap_an TRƯỚC
  2. Delay ~1s
  3. Play vcnv_xem_dap_an CÙNG lúc
  4. Cho phép OVERLAP (special case)
  5. KHÔNG dừng timer (nếu vẫn còn giờ)
```

#### **Rule 7: Group Exclusive (Chỉ 1 sound/group lúc đó)**
```
Group COUNTDOWN: EXCLUSIVE (Chỉ 1 lúc)
  - kd_dem_gio_5s
  - vcnv_dem_gio_15s
  - tt_dem_gio_20s, tt_dem_gio_30s
  - vd_dem_gio_15s, vd_dem_gio_20s

Quy tắc: Nếu cố play 2 timer cùng lúc → Queue, wait cái cũ kết thúc
```

#### **Rule 8: Sound Sequencing (Tuần Tự)**
```
Vòng Khởi Động:
  1. kd_bat_dau_choi (play ngay khi start vòng)
  2. Wait 3s
  3. kd_hien_cau_hoi (play để mở câu)
  4. Sound này PHẢI xong mới show câu (UI timing)

VCNV - Select Row:
  1. vcnv_chon_hang_ngang (play khi chọn hàng)
  2. Wait: Sound kết thúc
  3. kd_mo_cau_hoi (play tiếp)
  4. Sound này PHẢI xong mới show câu

Tăng Tốc - Reveal Answer:
  1. tt_mo_dap_an (play)
  2. Wait ~1s (không phải wait full duration)
  3. vcnv_xem_dap_an (play overlay)
  4. Cho phép OVERLAP
```

---

## VI. SoundCacheManager - Strategy

### 6.1 Preload Timing

#### **1. Preload Trước Session Olympia (MANDATORY)**
```
Khi nào: User vào thi → Trước khi question 1 show
Lúc nào: Trong loading phase (show loading bar)

Sound cần cache:
  - Tất cả sound trong olympia-sound-config.json
  - Không giới hạn, cache toàn bộ

Parallelization: Batch fetch 5-10 sound cùng lúc (tùy bandwidth)

Priority load:
  1. Tier 1: Các sound sẽ phát ngay (vòng đầu tiên)
  2. Tier 2: Các sound khác của Olympia
```

#### **2. Lazy Preload (OPTIONAL, tuỳ tình huống)**
```
Nếu cache fail lần 1:
  - Không crash
  - Mark sound as unavailable
  - Attempt retry khi vào vòng đó (non-blocking)
```

### 6.2 Cache Storage

#### **Memory-First Strategy**
```
Primary: AudioBuffer trong memory (native Web Audio API)
  - Fast access
  - Decoded & ready to play
  - No decode delay

Fallback: URL-based playback (không preload full)
  - Nếu memory limit exceeded
  - Play từ URL trực tiếp
  - Có delay nhỏ khi khởi tạo

Tránh: Service Worker cache (nếu chưa setup)
```

### 6.3 Implementation Structure

```
SoundCacheManager {
  private cache: Map<soundKey, AudioBuffer>
  private loadingPromises: Map<soundKey, Promise<AudioBuffer>>
  private failedSounds: Set<soundKey>
  private audioContext: AudioContext
  private config: OlympiaSoundConfig
  
  async preloadSound(soundKey: string): Promise<void>
    1. Check cache → return nếu đã có
    2. Check loadingPromises → return existing promise (avoid duplicate)
    3. Fetch URL từ buildSoundUrl()
    4. Handle 404, network error → add to failedSounds
    5. Decode AudioBuffer
    6. Store trong cache
    7. Return
  
  async preloadSounds(soundKeys: string[]): Promise<Result>
    1. Batch load (5-10 parallel)
    2. Collect loaded + failed
    3. Return summary
  
  isReady(soundKey: string): boolean
    return cache.has(soundKey)
  
  getAudioBuffer(soundKey: string): AudioBuffer | null
    return cache.get(soundKey) || null
}
```

---

## VII. Pseudo-Code & Implementation Guide

### 7.1 SoundController - Play Logic

```pseudocode
async function play(soundKey: string, options?: PlayOptions): Promise<Result> {
  // Step 1: Validate sound exists
  if (!soundConfig.sounds[soundKey]) {
    LOG_ERROR(`Sound "${soundKey}" not found in config`)
    return { success: false, error: "Sound not found" }
  }

  // Step 2: Check cache status
  if (!soundCache.isReady(soundKey)) {
    LOG_WARN(`Sound "${soundKey}" not cached yet`)
    // Option A: Wait for cache (blocking)
    // await soundCache.preloadSound(soundKey)
    // Option B: Log warning, skip play
    return { success: false, error: "Sound not cached" }
  }

  // Step 3: Get override rules
  const soundsToStop = overrideEngine.getSoundsThatMustStop(soundKey)
  const currentlyPlaying = playbackStateManager.getPlayingKeys()
  
  // Step 4: Apply override
  for (const stopKey of soundsToStop) {
    if (currentlyPlaying.includes(stopKey)) {
      stop(stopKey)
    }
  }

  // Step 5: Apply delay (if specified)
  if (options?.delay) {
    await wait(options.delay)
  }

  // Step 6: Create audio source
  const audioBuffer = soundCache.getAudioBuffer(soundKey)
  const source = audioContext.createBufferSource()
  source.buffer = audioBuffer
  source.loop = soundConfig.sounds[soundKey].loop || false
  
  // Step 7: Set volume
  const gainNode = audioContext.createGain()
  gainNode.gain.value = soundConfig.sounds[soundKey].volume || 1.0
  source.connect(gainNode)
  gainNode.connect(audioContext.destination)

  // Step 8: Register end callback
  source.onended = () => {
    playbackStateManager.setStopped(soundKey)
    if (options?.onEnd) {
      options.onEnd()
    }
  }

  // Step 9: Start playback
  source.start(0)
  playbackStateManager.setPlaying(soundKey, source)
  
  LOG_INFO(`Sound "${soundKey}" started`, {
    loop: source.loop,
    volume: gainNode.gain.value,
    delay: options?.delay || 0
  })
  
  return { success: true }
}

function stop(soundKey: string) {
  const state = playbackStateManager.getState(soundKey)
  
  if (!state || state.state === "stopped") {
    return
  }

  if (state.sourceNode) {
    try {
      state.sourceNode.stop(0)
    } catch (err) {
      LOG_WARN(`Error stopping sound "${soundKey}"`, err)
    }
  }

  playbackStateManager.setStopped(soundKey)
  LOG_DEBUG(`Sound "${soundKey}" stopped`)
}

function stopGroup(groupName: string) {
  const soundsInGroup = overrideEngine.getSoundGroup(groupName)
  
  for (const soundKey of soundsInGroup) {
    stop(soundKey)
  }
  
  LOG_DEBUG(`Group "${groupName}" stopped (${soundsInGroup.length} sounds)`)
}

function stopAll() {
  const playingKeys = playbackStateManager.getPlayingKeys()
  
  for (const soundKey of playingKeys) {
    stop(soundKey)
  }
  
  LOG_INFO(`All sounds stopped (${playingKeys.length} sounds)`)
}
```

### 7.2 SoundEventDispatcher - Event Handling

```pseudocode
async function handleGameEvent(eventType: string, payload: any): Promise<void> {
  switch (eventType) {
    case "ROUND_STARTED":
      await handleRoundStarted(payload)
      break
      
    case "QUESTION_REVEALED":
      await handleQuestionRevealed(payload)
      break
      
    case "TIMER_STARTED":
      await handleTimerStarted(payload)
      break
      
    case "CORRECT_ANSWER":
      await handleCorrectAnswer(payload)
      break
      
    case "WRONG_ANSWER":
      await handleWrongAnswer(payload)
      break
      
    case "TIMER_ENDED":
      await handleTimerEnded(payload)
      break
      
    case "ROUND_ENDED":
      await handleRoundEnded(payload)
      break
      
    case "STAR_REVEALED":
      await handleStarRevealed(payload)
      break
      
    case "SESSION_ENDED":
      await handleSessionEnded(payload)
      break
      
    default:
      LOG_WARN(`Unknown event: "${eventType}"`)
  }
}

async function handleRoundStarted(payload: { roundType: string }): Promise<void> {
  const { roundType } = payload
  
  // Step 1: Stop all previous sounds
  soundController.stopAll()
  
  // Step 2: Play background/intro sound based on round type
  switch (roundType) {
    case "khoi_dong":
      // Play: kd_bat_dau_choi (loop)
      await soundController.play("kd_bat_dau_choi", {
        delay: 0
      })
      // Delay 3s then play question reveal
      setTimeout(() => {
        soundController.play("kd_hien_cau_hoi", {
          onEnd: () => {
            // Signal: Question can be revealed now
            gameEventBus.emit("SOUND_READY_FOR_QUESTION_REVEAL")
          }
        })
      }, 3000)
      break
      
    case "vcnv":
      // TODO: Implement VCNV start logic
      break
      
    case "tang_toc":
      // TODO: Implement Tăng Tốc start logic
      break
      
    case "ve_dich":
      // TODO: Implement Về Đích start logic
      break
  }
}

async function handleCorrectAnswer(payload: { 
  roundType: string,
  playerId: string 
}): Promise<void> {
  const { roundType } = payload
  
  // Step 1: Stop timer
  const timerSounds = {
    khoi_dong: "kd_dem_gio_5s",
    vcnv: "vcnv_dem_gio_15s",
    tang_toc: ["tt_dem_gio_20s", "tt_dem_gio_30s"],
    ve_dich: ["vd_dem_gio_15s", "vd_dem_gio_20s"]
  }
  
  const timerSound = timerSounds[roundType]
  if (Array.isArray(timerSound)) {
    timerSound.forEach(s => soundController.stop(s))
  } else {
    soundController.stop(timerSound)
  }
  
  // Step 2: Play correct answer sound
  const correctSounds = {
    khoi_dong: "kd_dung",
    vcnv: "vcnv_dung",
    tang_toc: null,
    ve_dich: "vd_dung"
  }
  
  const correctSound = correctSounds[roundType]
  if (correctSound) {
    await soundController.play(correctSound, {
      onEnd: () => {
        // After correct sound: check if all players scored
        // Then trigger round end or continue
      }
    })
  }
}

async function handleStarRevealed(payload: any): Promise<void> {
  // Priority: Stop EVERYTHING
  soundController.stopAll()
  
  // Play star sound
  await soundController.play("vd_ngoi_sao", {
    onEnd: () => {
      // Resume game flow
      gameEventBus.emit("STAR_SOUND_FINISHED")
    }
  })
}

async function handleSessionEnded(payload: any): Promise<void> {
  // Step 1: Stop all sounds
  soundController.stopAll()
  
  // Step 2: Play final summary (optional)
  await soundController.play("tong_ket_ket_qua", {
    onEnd: () => {
      LOG_INFO("Session ended, clearing cache")
      // Step 3: Clear cache
      soundCache.clearAll()
      // Disconnect AudioContext
      audioContext.close()
    }
  })
}
```

### 7.3 OverrideRulesEngine - Rule Definition

```pseudocode
class OverrideRulesEngine {
  private rules: Map<string, OverrideRule> = new Map()
  private soundGroups: Map<string, string[]> = new Map()

  constructor(config: OlympiaSoundConfig) {
    this.initializeRules(config)
  }

  private initializeRules(config: OlympiaSoundConfig): void {
    // Rule 1: Sound với autoStopWhenOtherPlays=true
    for (const [soundKey, soundDef] of Object.entries(config.sounds)) {
      if (soundDef.autoStopWhenOtherPlays) {
        // This sound will stop others when played
        this.rules.set(soundKey, {
          type: "STOP_OTHERS",
          priority: HIGH,
          excludeGroups: ["BACKGROUND"] // Don't stop background loops
        })
      }
    }

    // Rule 2: Timer sounds are exclusive
    const timerSounds = [
      "kd_dem_gio_5s",
      "vcnv_dem_gio_15s",
      "tt_dem_gio_20s",
      "tt_dem_gio_30s",
      "vd_dem_gio_15s",
      "vd_dem_gio_20s"
    ]
    this.soundGroups.set("COUNTDOWN", timerSounds)

    // Rule 3: Correct answer sounds override timer
    const correctSounds = ["kd_dung", "vcnv_dung", "vd_dung"]
    this.soundGroups.set("CORRECT_ANSWER", correctSounds)
    for (const sound of correctSounds) {
      this.rules.set(sound, {
        type: "STOP_TIMERS",
        priority: CRITICAL
      })
    }

    // Rule 4: Star sound - highest priority
    this.rules.set("vd_ngoi_sao", {
      type: "STOP_ALL",
      priority: MAXIMUM
    })
  }

  getSoundsThatMustStop(soundKeyToPlay: string): string[] {
    const rule = this.rules.get(soundKeyToPlay)
    
    if (!rule) {
      // No special rule → default behavior (don't stop others)
      return []
    }

    const mustStop: string[] = []

    switch (rule.type) {
      case "STOP_OTHERS":
        // Stop all except background
        const allSounds = Object.keys(soundConfig.sounds)
        for (const sound of allSounds) {
          if (!this.isInGroup(sound, "BACKGROUND")) {
            mustStop.push(sound)
          }
        }
        break

      case "STOP_TIMERS":
        // Stop only timer sounds
        const timerGroup = this.soundGroups.get("COUNTDOWN") || []
        mustStop.push(...timerGroup)
        break

      case "STOP_ALL":
        // Stop everything
        mustStop.push(...Object.keys(soundConfig.sounds))
        break
    }

    return mustStop
  }

  canOverride(
    soundKeyToPlay: string,
    currentlyPlayingSoundKey: string
  ): boolean {
    const newPriority = this.getPriority(soundKeyToPlay)
    const currentPriority = this.getPriority(currentlyPlayingSoundKey)
    
    return newPriority > currentPriority
  }

  getPriority(soundKey: string): number {
    const rule = this.rules.get(soundKey)
    
    if (!rule) {
      return PRIORITY.NORMAL
    }

    if (rule.priority === MAXIMUM) return 999
    if (rule.priority === CRITICAL) return 100
    if (rule.priority === HIGH) return 50
    
    return PRIORITY.NORMAL
  }

  getSoundGroup(groupName: string): string[] {
    return this.soundGroups.get(groupName) || []
  }

  private isInGroup(soundKey: string, groupName: string): boolean {
    const group = this.soundGroups.get(groupName) || []
    return group.includes(soundKey)
  }
}

// Priority Constants
const PRIORITY = {
  NORMAL: 0,
  HIGH: 50,
  CRITICAL: 100,
  MAXIMUM: 999
}
```

---

## VIII. Error Handling & Edge Cases

### 8.1 Cache Errors

#### **404 - Sound File Not Found**
```
Scenario: File bị xoá hoặc fileName sai trong config

Handling:
  1. Log warning: { soundKey, url, status: 404 }
  2. Mark sound as unavailable
  3. App continues (NO crash)
  4. Nếu user trigger play sound đó:
     - Log warning "Sound unavailable"
     - Skip play, return success=false
     - UI không cần show error

Policy: Graceful degradation
```

#### **Network Timeout**
```
Scenario: Supabase Storage không phản hồi

Handling:
  1. Retry tối đa 2 lần (configurable)
  2. Log error: { soundKey, error, attemptCount }
  3. Mark as failed
  4. Continue preload other sounds
  
Timeout: 10s/sound (configurable)
```

#### **Memory Limit Exceeded**
```
Scenario: Cache toàn bộ sound vượt RAM available

Handling:
  1. Monitor cache size
  2. Nếu > 100MB (configurable):
     - Stop preload
     - Mark remaining as "fallback to URL"
  3. Khi play:
     - Check if cached → play cached
     - Nếu không → stream from URL (no preload buffer)
```

### 8.2 Playback Errors

#### **AudioContext Suspended**
```
Scenario: Browser suspend AudioContext (user không interact)

Handling:
  1. On first user interaction:
     - Resume AudioContext
     - Retry play sound
  2. Log: { audioContextState, eventType }
```

#### **Spam Click - Multiple Play Calls**
```
Scenario: User spam-click button → sound.play() called 5 times

Handling:
  1. Queue system:
     - Accept first play
     - Queue remaining
     - Execute queue after prev sound ends
  2. Alternative: Ignore duplicate
     - Nếu soundKey đang phát → ignore new request
     - Log warning: "Sound already playing"
```

#### **Tab Visibility Changed**
```
Scenario: User switch tab → AudioContext pause

Handling:
  1. Pause all playing sounds
  2. On tab active again:
     - Resume sounds (nếu game state valid)
     - Nếu game flow changed (timer ended, new round):
       - Stop & ignore old sounds
```

### 8.3 Game State Edge Cases

#### **Round Switched While Sound Playing**
```
Scenario: Admin change round while sound đang phát

Handling:
  1. New round start
  2. stopAll() được gọi
  3. Interrupt current playback
  4. Start new round sounds
```

#### **Session Resumed After Pause**
```
Scenario: App crash/resume → game state recovered

Handling:
  1. Validate sound config still matches cache
  2. Nếu mismatch:
     - Clear old cache
     - Preload new sounds
  3. Resume playback tuỳ current game state
```

#### **Slow Network - Sound Not Cached in Time**
```
Scenario: Preload chậm → round start nhưng sound chưa ready

Handling:
  1. Queue play request
  2. Wait tối đa 3s cho cache ready
  3. Nếu timeout:
     - Log warning
     - Skip sound, continue game
     - Fallback to URL stream (non-preload)
```

### 8.4 Audio Context Lifecycle

#### **App Unmount**
```
cleanup() {
  1. Stop all sounds
  2. Disconnect all nodes
  3. Close AudioContext
  4. Clear cache
  5. Unsubscribe from events
}
```

---

## IX. Integration Points

### 9.1 Where Sound Controller is Used

```
1. useOlympiaGameState.ts (client component)
   - Subscribe game events
   - Route events to SoundEventDispatcher
   
2. HostRealtimeEventsListener.tsx (admin)
   - Listen realtime events
   - Trigger sounds via dispatcher

3. Round-specific components:
   - KhoiDongRound.tsx
   - VCNVRound.tsx
   - TangTocRound.tsx
   - VeDichRound.tsx
   - Call soundController.play() when needed

4. Scoring components:
   - ScoreDisplay.tsx
   - CorrectAnswerDisplay.tsx
   - Call soundController.play() for feedback
```

### 9.2 Initialization Sequence

```
1. App Start
   ↓
2. Detect Olympia Session
   ↓
3. Initialize SoundCacheManager
   └─ Create AudioContext
   └─ Load config
   ↓
4. User enters thi
   ↓
5. Preload phase:
   └─ soundCache.preloadSounds([all keys from config])
   └─ Show progress bar
   ↓
6. Preload complete
   └─ Initialize SoundEventDispatcher
   └─ Subscribe game events
   ↓
7. Round 1 starts
   └─ All sounds ready
   └─ Play sound normally
```

---

## X. [GIẢ ĐỊNH] - Assumptions & Clarifications

### Các giả định đã đưa ra:

1. **AudioContext Creation**
   - Giả định: App đã có khái niệm AudioContext (Web Audio API)
   - Thực tế: Cần khởi tạo 1 lần ở app startup

2. **Preload Timing**
   - Giả định: Có loading phase trước khi thi bắt đầu
   - Dùng cho: Cache preload without blocking question reveal

3. **Event Bus**
   - Giả định: App đã có event system (realtime-guard + handleRealtimeEvent)
   - SoundEventDispatcher subscribe vào event bus này

4. **No Service Worker Assumption**
   - Sound cache dùng memory AudioBuffer, KHÔNG dùng Service Worker
   - Nếu sau này integrate SW → có thể optimize thêm

5. **URL Format Fixed**
   - Giả định: `https://fbxrlpiigoviphaxmstd.supabase.co/storage/v1/object/public/olympia/Olympia%20Sound/{fileName}.mp3` (ĐÚNG)
   - KHÔNG thay đổi trong tương lai gần

6. **No Sound Duration Config**
   - Giả định: Thời gian phát sound = duration của file mp3
   - KHÔNG cần config riêng duration
   - onended callback xác định lúc sound kết thúc

7. **Single AudioContext Instance**
   - Giả định: Toàn bộ app dùng 1 AudioContext
   - KHÔNG tạo multiple contexts (waste resource)

---

## XI. Recommendations - Next Steps

### Phase 1: Implementation Core
1. **SoundCacheManager** (lib/olympia/soundCache.ts)
   - Implement preload, isReady, getAudioBuffer
   - Error handling & retry logic

2. **PlaybackStateManager** (lib/olympia/playbackState.ts)
   - Track playing/paused/stopped state
   - Maintain source node references

3. **OverrideRulesEngine** (lib/olympia/overrideRules.ts)
   - Define all rules from Section V
   - Priority system & group management

4. **SoundController** (lib/olympia/soundController.ts)
   - Integrate cache + state + rules
   - play(), stop(), stopGroup(), stopAll()

5. **buildSoundUrl Helper** (lib/olympia/olympia-sound-url.ts)
   - URL builder + fileName extractor

### Phase 2: Integration
1. **SoundEventDispatcher** (lib/olympia/soundDispatcher.ts)
   - Event handlers từ Section V
   - Route to SoundController

2. **Hook Integration** (hooks/olympia/useSound.ts)
   - Expose soundController to components
   - Initialize on mount

3. **Game Component Integration**
   - Pass soundController prop
   - Call play() when needed

### Phase 3: Testing
1. Unit tests:
   - Override rules logic
   - Cache preload scenarios
   - Error handling

2. Integration tests:
   - Event → sound mapping
   - Round transitions
   - Session lifecycle

3. Manual testing:
   - Audio quality
   - Timing accuracy
   - Edge cases (spam click, pause, resume)

---

## XII. Config & Constants

### 12.1 Preload Configuration

```typescript
// lib/olympia/olympia-sound-constants.ts

export const SOUND_CONFIG = {
  // Preload
  PRELOAD_BATCH_SIZE: 5, // Parallel fetch limit
  PRELOAD_TIMEOUT_MS: 10000, // Timeout per sound
  PRELOAD_RETRY_COUNT: 2,
  
  // Cache
  MAX_CACHE_SIZE_MB: 100,
  ENABLE_MEMORY_CACHE: true,
  ENABLE_URL_FALLBACK: true,
  
  // Playback
  DEFAULT_VOLUME: 1.0,
  QUEUE_MAX_SIZE: 20,
  QUEUE_TIMEOUT_MS: 3000,
  
  // Audio context
  SAMPLE_RATE: 48000, // tuỳ browser
  
  // Timing
  ROUND_START_DELAY_MS: 3000, // Delay trước mở câu
  CORRECT_ANSWER_WAIT_MS: 2000, // Delay trước end-round
  WRONG_ANSWER_WAIT_MS: 2000,
  REVEAL_ANSWER_OVERLAP_MS: 1000, // Overlap sound tăng tốc
  
  // Logging
  LOG_CACHE_STATS: true,
  LOG_PLAYBACK_EVENTS: true,
  LOG_OVERRIDE_DECISIONS: true
}
```

---

## XIII. Monitoring & Debugging

### 13.1 Logging Strategy

```typescript
// Levels: DEBUG, INFO, WARN, ERROR

LOG_DEBUG("Sound preload started", { soundCount, totalSize })
LOG_INFO("Sound cache ready", { loaded: 45, failed: 2 })
LOG_WARN("Sound not cached yet", { soundKey, attempt: 1 })
LOG_ERROR("Sound play failed", { soundKey, error: reason })

// Track metrics
METRICS.recordCacheLoadTime(soundKey, durationMs)
METRICS.recordPlaybackError(soundKey, errorType)
```

### 13.2 Debugging Tools

```typescript
// Expose debug API (development only)
window.__OLYMPIA_SOUND__ = {
  getCache: () => soundCache.cache,
  getPlayingKeys: () => playbackStateManager.getPlayingKeys(),
  play: (soundKey) => soundController.play(soundKey),
  stop: (soundKey) => soundController.stop(soundKey),
  stopAll: () => soundController.stopAll(),
  getOverrideRules: (soundKey) => overrideEngine.getSoundsThatMustStop(soundKey),
  getAudioContext: () => audioContext
}
```

---

## XIV. Version & Change Log

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-20 | Initial architecture design |

---

**Dokumentasi này là DESIGN PHASE - Chưa có code.**

**Next step: Implement theo Phase 1 recommendations.**
