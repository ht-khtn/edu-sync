# Plan: Fix Leaderboard, Stats, Reports & Add OLYMPIA Sidebar

**Date:** December 9, 2025  
**Scope:** 6 major fixes across leaderboard, violation-stats, report export, violation entry, sidebar, and OLYMPIA features

---

## Issues to Fix

### 1. Leaderboard Pages - Show All Classes Grouped by Khối + Base Points
**Current Issue:** Only shows classes that have violation records. Missing base points feature.

**Requirements:**
- Display ALL classes in the system, even those with no violations
- Group classes by khối (grade/block)
- Implement base points feature (default 500)
- Points calculation: `basePoints - totalViolationScore`
- Add UI control to set custom base points per view

**Files to Modify:**
- `components/admin/leaderboard/Page.tsx` - Main leaderboard display logic
- `lib/cached-queries.ts` - `getLeaderboard()` function to return grade-grouped data
- Possibly `app/(admin)/admin/leaderboard/page.tsx` - Route wrapper

**Technical Details:**
- Current: Uses `getAllowedClassIdsForView()` to filter visible classes
- Current: Aggregates records by class_id, filters by score > 0
- New: Query must include all classes from grades table, left-join with records
- New: Group by grade on frontend before rendering
- New: Add basePoints state/input field (default 500)

---

### 2. Violation-Stats Page - Show All Classes Grouped by Khối
**Current Issue:** Shows only classes with violation records. No grade grouping in main UI (only in export).

**Requirements:**
- Display ALL classes grouped by khối (grade)
- Show statistics for each class, including classes with 0 violations
- Maintain two tabs: "Theo lỗi vi phạm" and "Theo lớp"
- Apply same access control as before

**Files to Modify:**
- `components/admin/violation-stats/Page.tsx` - Main stats aggregation and display
- `lib/cached-queries.ts` - Possibly create new query function for stats that includes all classes
- `components/admin/violation-stats/ExportDialog.tsx` - Already handles grouping in export (may not need changes)

**Technical Details:**
- Current: Filters records by school scope only
- Current: Uses `Map<classId, {...}>` aggregation
- New: Must also fetch all classes from grades table
- New: For stats display, show classes grouped by grade with 0 values for missing criteria
- New: Maintain same filtering/access control logic

---

### 3. Show Leaderboard Link in Sidebar
**Current Issue:** Leaderboard link disappeared from sidebar navigation.

**Requirements:**
- Make leaderboard link visible in sidebar again
- Position: operations section, before or after "Bảng điều khiển"
- Should appear for all users (already has Trophy icon in operationsNavItems)

**Files to Modify:**
- `components/admin/layout/AdminSidebar.tsx` - Check if leaderboard link is filtered out

**Technical Details:**
- Current structure shows leaderboard should be in operationsNavItems
- Check if it's being hidden by a condition or removed from array
- Verify it doesn't have `requires: "..."` condition that might exclude some users

---

### 4. Report Export - Allow Selecting Violations & Show All Columns
**Current Issue:** 
- Can only export violations that have been recorded (no way to select which ones)
- Columns with 0 violations are hidden

**Requirements:**
- Add UI to select which violation types (groups/subgroups) to include in export
- Show selected groups/subgroups as columns even if they have 0 violations for that class
- Maintain date range and base score filters
- Display violations organized by group/subgroup hierarchy

**Files to Modify:**
- `components/admin/violation-stats/ExportDialog.tsx` - Export dialog component
  - Add multi-select for criteria/groups
  - Modify Excel building logic to include all selected criteria columns
  - Update column headers to show even 0-count violations

**UI Changes:**
- Add checkbox tree/multi-select component showing:
  ```
  Group 1
    ☐ Subgroup 1.1
    ☐ Subgroup 1.2
  Group 2
    ☐ Subgroup 2.1
  Khác
    ☐ Mục
  ```
- User can expand/collapse groups and select which to include
- "Select All" / "Deselect All" buttons for convenience

**Technical Details:**
- Current: Builds group structure from actual records found
  ```typescript
  const groups = new Map<string, Set<string>>()
  for (const r of recs) {
    const g = r.criteria?.group || "Khác"
    const sg = r.criteria?.subgroup || r.criteria?.name || "Mục"
    groups.get(g)?.add(sg)
  }
  ```
- New: Must fetch ALL criteria/groups and let user select subset
- New: When building Excel, include all selected groups/subgroups as columns, use 0 for missing values
- New: Maintain current structure for other columns (Class, Date, etc.)

---

### 5. Violation Entry - Allow MOD/SEC to Record Violations
**Current Issue:** Only CC (Class Committee) can record violations. MOD and SEC cannot.

**Requirements:**
- Allow MOD (Moderator) to record violations for all classes in school scope
- Allow SEC (School Committee) to record violations for their assigned target classes
- Maintain current student list filtering per class scope
- Keep class selection limited to user's allowed classes (per RBAC rules)

**Files to Modify:**
- `lib/rbac.ts` - Update `canEnterViolations` logic
  - Current: `canEnterViolations = hasCC && !hasSchoolScope`
  - New: Include MOD and SEC roles
- `components/admin/violation-entry/Page.tsx` - Check access control logic
- Form component (referenced in entry page) - Verify it respects updated access rules

**Current Access Control:**
```typescript
// app/(admin)/admin/violation-entry/page.tsx
const summary = summarizeRoles(roles)
if (!summary.canEnterViolations) {
  return redirect(...)
}
```

**New Logic:**
- `canEnterViolations = true` if has ANY of: CC, MOD, SEC roles
- Form component should still filter classes based on user's RBAC scope/target
  - CC: only their class
  - SEC: classes matching their target field
  - MOD: all classes in school (school scope)

**Technical Details:**
- Update `summarizeRoles()` return type or change `canEnterViolations` calculation
- Maintain student list filtering per selected class
- Keep form validation to prevent recording for unauthorized classes

---

### 6. Add OLYMPIA Section to Sidebar
**Current Issue:** OLYMPIA features exist but have no link in main admin sidebar.

**Requirements:**
- Add new "OLYMPIA" section in AdminSidebar (after operations section or at end)
- Include two menu items:
  - "Olympia Admin" → `/admin/olympia-accounts`
  - "Olympia Thí sinh" → `/olympia/admin/accounts?role=contestant`
- Show OLYMPIA section only for users who have OLYMPIA participant record
- Use appropriate icons (GraduationCap, KeySquare, or similar)

**Files to Modify:**
- `components/admin/layout/AdminSidebar.tsx` - Add new olympia section
- May need to create helper function to check if user has OLYMPIA access

**Current Related Code:**
- `/admin` dashboard already has these card links
- `lib/olympia-access.ts` has `getOlympiaParticipant()` function
- OLYMPIA routing exists at `app/(olympia)/olympia/`

**Implementation:**
```typescript
// In AdminSidebar, add new section:
const olympiaNavItems = [
  { title: "Olympia Admin", href: "/admin/olympia-accounts", icon: KeySquare },
  { title: "Olympia Thí sinh", href: "/olympia/admin/accounts?role=contestant", icon: GraduationCap },
]

// Show only if user has olympia participant record
const hasOlympiaAccess = await checkOlympiaParticipant(userId)
```

---

### 7. Complete OLYMPIA Add Admin Feature
**Current Issue:** Admin panel for adding/managing OLYMPIA admins may be incomplete.

**Requirements:**
- Ensure `/admin/olympia-accounts` page allows selecting users and assigning `role='AD'`
- Verify logic for updating `olympia.participants` table with role field
- Ensure proper access control (only OLYMPIA admins can manage)

**Files to Check/Modify:**
- `app/(admin)/admin/olympia-accounts/page.tsx` - Main page (verify existence)
- Route structure for OLYMPIA accounts management
- Database access layer for olympia.participants updates

**Current Access Control:**
- `ensureOlympiaAdminAccess()` checks if user has `role='AD'` in olympia.participants
- Only OLYMPIA admins can access `/olympia/admin/` routes

**Implementation Notes:**
- Form should allow selecting target user by username/email
- Checkbox or toggle for "Assign Admin Role"
- Submit button calls server action to update olympia.participants
- Confirmation message on success
- Error handling for invalid users

---

## Implementation Steps (Sequential)

1. ✅ **Plan documentation** - This file
2. ⏳ **Modify leaderboard** - Add grade grouping, show all classes, add base points
3. ⏳ **Fix violation-stats** - Add grade grouping, show all classes
4. ⏳ **Fix leaderboard sidebar** - Make link visible again
5. ⏳ **Enhance export dialog** - Add violation selection, show all columns
6. ⏳ **Update violation entry access** - Allow MOD/SEC to record
7. ⏳ **Add OLYMPIA sidebar section** - Show OLYMPIA nav items
8. ⏳ **Complete OLYMPIA admin page** - Verify/finish add admin functionality

---

## Technical Considerations

### Base Points Configuration
- **Recommendation:** Configurable per export session, default 500
- Store in component state, not persisted to database
- Show in export dialog before generating Excel
- Allow changes before final Excel generation

### MOD/SEC Violation Entry Scope
- **MOD:** Can record for all classes in school (school scope)
- **SEC:** Can record only for classes matching their `target` field in user_roles
- **CC:** Can record only for their own class
- Form must filter class dropdown accordingly

### Grade/Khối Sorting
- **Recommendation:** Sort by grade name as-is from database
- If grade names are "10", "11", "12", they'll sort correctly
- Add option for numeric sort if needed later

### OLYMPIA Participant Check
- Use `getOlympiaParticipant()` from `lib/olympia-access.ts`
- Show OLYMPIA sidebar section only if participant record exists (any role or code)
- Don't block sidebar rendering if OLYMPIA access fails (graceful degradation)

### Export Column Inclusion
- Current behavior: Hidden columns if no violations
- New behavior: Show all selected violation columns, use 0 for missing data
- Maintain consistent column order across all exports
- Consider adding "Total Violations" column

---

## File Change Summary

| File | Change | Complexity |
|------|--------|-----------|
| `components/admin/leaderboard/Page.tsx` | Rewrite aggregation + grouping logic | High |
| `lib/cached-queries.ts` | Update `getLeaderboard()` return structure | Medium |
| `components/admin/violation-stats/Page.tsx` | Add grade grouping to main display | High |
| `components/admin/violation-stats/ExportDialog.tsx` | Add criteria selection UI + column logic | High |
| `lib/rbac.ts` | Update `canEnterViolations` logic | Low |
| `components/admin/violation-entry/Page.tsx` | Update access check (uses updated RBAC) | Low |
| `components/admin/layout/AdminSidebar.tsx` | Add OLYMPIA section + check function | Medium |
| `app/(admin)/admin/olympia-accounts/page.tsx` | Complete/verify add admin feature | Medium-High |

---

## Testing Checklist

- [ ] Leaderboard shows all grades/khối with all classes
- [ ] Base points can be customized (default 500)
- [ ] Leaderboard ranking adjusts with different base points
- [ ] Violation-stats shows all classes grouped by khối
- [ ] Stats show 0 for classes with no violations in that criteria
- [ ] Leaderboard link visible in sidebar for all users
- [ ] Export dialog allows selecting violation groups/subgroups
- [ ] Export Excel includes all selected violation columns
- [ ] Columns with 0 violations still appear in export
- [ ] MOD can access violation entry form
- [ ] SEC can access violation entry form
- [ ] MOD/SEC can only select allowed classes
- [ ] OLYMPIA section visible in sidebar for OLYMPIA participants
- [ ] OLYMPIA admin page allows assigning AD role
- [ ] OLYMPIA thí sinh link goes to correct page

---

## Notes

- All changes maintain backward compatibility with existing RBAC system
- No database schema changes required
- All data already exists; changes are presentation/filtering logic
- Consider adding unit tests for new grouping/filtering logic
