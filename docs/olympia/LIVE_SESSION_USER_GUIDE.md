# Olympia Live Session Management - User Guide

## Quick Start for Admin Users

### Opening a Live Session

1. Navigate to **Admin Console → Trận thi → Chi tiết trận** (Match Details)
2. Click **Mở phòng cho trận này** (Open room for this match)
3. The system automatically generates:
   - Join code for students
   - Player password (students enter this)
   - MC/Observer password (for hosts/judges)
4. Passwords display with copy buttons—share with participants

### Host Console

Access the host console at `/olympia/admin/matches/{matchId}/host`

#### Features:
- **Session Status**: Shows if room is open, join code, current round
- **Round Control**: Select round from dropdown, changes apply to all clients
- **Question State**: 
  - Hidden (default)
  - Showing (reveal question)
  - Answer Revealed (show correct answer)
  - Completed (move to next)
- **Scoreboard**: Real-time ranking of all players
- **Player Roster**: Seat numbers, names, current scores

### Setting Up Match Rounds

If a match has no rounds:

1. Open match in admin console
2. Click **Tạo 4 vòng mặc định** (Create 4 default rounds)
   - Khởi động (Kickoff)
   - Vượt chướng ngại vật (Obstacle Course)
   - Tăng tốc (Speed Round)
   - Về đích (Final Sprint)

### Assigning Questions to Rounds

1. In match detail page, find **Gán câu hỏi cho vòng** button
2. Select one question per round
3. Questions show difficulty badge
4. Click **Lưu gán câu hỏi** to save

### Managing Session Lifecycle

```
Draft Match
    ↓
Create Rounds (if needed)
    ↓
Open Session (generates codes/passwords)
    ↓
Select Round (from dropdown)
    ↓
Control Question State (hidden → showing → answer_revealed → completed)
    ↓
End Session
    ↓
View Results/History
```

## For Students/Players

### Joining a Live Match

1. Get join code from instructor
2. Enter code in join screen
3. May need to enter password (if enabled)
4. Wait for host to start round

### During Match

- Watch timer countdown
- See current question when host reveals it
- Submit answer or buzz
- Watch scoreboard update in real-time

## For Observers/MC

### Accessing Observer Mode

1. Use MC password to unlock observer view
2. See all participant submissions in real-time
3. Can interact with game state (with proper admin access)

## Troubleshooting

### Session won't open
- Check that match exists and has valid status
- Ensure you have admin permissions
- Try refreshing the page

### Passwords not showing
- Passwords only display immediately after opening session
- They're generated automatically and stored securely
- If needed, close and re-open session to get new passwords

### Players not seeing updates
- Check player's realtime connection status
- Ensure question state has been set after each round
- Try page refresh if state appears stuck

### Scores not updating
- Scores update when players submit answers
- Allow 2-3 seconds for real-time sync
- Refresh page to see latest scores

## Keyboard Shortcuts

Currently available through UI buttons. Keyboard shortcuts for host console coming soon.

## Accessibility Notes

- All buttons have aria-labels for screen readers
- Passwords can be shown/hidden for privacy
- High contrast badges for status display
- Tab navigation supported throughout

## API Notes

Admin endpoints require Olympia admin role. Session updates broadcast to all connected clients via Supabase realtime.
