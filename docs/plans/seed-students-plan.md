# Kế hoạch seed học sinh & lớp cho EduSync

## Mục tiêu

1. Tạo đầy đủ các lớp theo khối 10, 11, 12 trong bảng `public.classes` (và `public.grades` nếu cần).
2. Đọc danh sách học sinh từ file CSV `../.specific/dshs.csv`.
3. Sinh `auth.users` (đã confirm) cho từng học sinh bằng Supabase Admin API.
4. Dựa vào các trigger đã tồn tại để tự động tạo bản ghi trong `public.users` và `public.user_profiles`.
5. Cập nhật lại `full_name`, `date_of_birth` trong `public.user_profiles` và `class_id` trong `public.users` cho đúng với CSV.

## Giả định & ràng buộc

- Supabase project đã được cấu hình và app đang dùng các helper trong `lib/supabase-server.ts` hoặc `lib/supabase.ts`.
- Có sẵn `SERVICE_ROLE_KEY` (hoặc tương đương) trong biến môi trường để dùng Admin API (tạo user trong `auth.users`).
- Các trigger sau đã tồn tại:
  - Khi `auth.users` INSERT: tạo row tương ứng trong `public.users` (`fn_auth_user_created`).
  - Khi `public.users` INSERT: tạo row tối thiểu trong `public.user_profiles` (`create_user_profile_on_user_insert`).
- Bảng `public.classes` có cấu trúc: `id`, `grade_id`, `name`, `homeroom_teacher_id`, `created_at`.
- Bảng `public.grades` chỉ có `id`, `name`, `created_at`. Ta sẽ dùng `name` là chuỗi như `"10"`, `"11"`, `"12"`.

## Quy ước email / username

Theo yêu cầu:

- email: `{ghép các chữ cái trước và tên người đó}{mã lớp (không lấy khối)}{niên khóa}@edusync.edu.vn`
- password: `123`
- username: giống email nhưng bỏ `@edusync.edu.vn`.

### Diễn giải chi tiết (rule mới theo ví dụ)

Từ CSV: cột `Họ và tên`, `Khối`, `Lớp`.

Ví dụ do bạn cung cấp:

- Nguyễn Minh Luân, 12A3 → `nmluana32326@edusync.edu.vn`
- Huỳnh Thị Ngọc Ngân, 12A5 → `htnngana52326@edusync.edu.vn`
- Nguyễn Văn An, 10A5 → `nvana52528@edusync.edu.vn`

Quy tắc chính xác:

1. Chuẩn hóa tên:
  - Bỏ dấu tiếng Việt, đưa về chữ thường.
  - Loại bỏ ký tự đặc biệt, chỉ giữ chữ cái, số và khoảng trắng để tách từ.
  - Ví dụ:
    - `"Nguyễn Minh Luân"` → `['nguyen', 'minh', 'luan']`
    - `"Huỳnh Thị Ngọc Ngân"` → `['huynh', 'thi', 'ngoc', 'ngan']`
    - `"Nguyễn Văn An"` → `['nguyen', 'van', 'an']`
2. Xác định tên chính:
  - Tên chính là token cuối cùng (last token): `luan`, `ngan`, `an`.
3. Lấy initials của phần họ + đệm:
  - Lấy chữ cái đầu của từng token **trước** token cuối:
    - `Nguyễn Minh Luân` → `n` (Nguyễn) + `m` (Minh) → `nm`.
    - `Huỳnh Thị Ngọc Ngân` → `h` (Huỳnh) + `t` (Thị) + `n` (Ngọc) → `htn`.
    - `Nguyễn Văn An` → `n` (Nguyễn) + `v` (Văn) → `nv`.
4. Ghép prefix + tên chính:
  - `Nguyễn Minh Luân` → `nm` + `luan` = `nmluan`.
  - `Huỳnh Thị Ngọc Ngân` → `htn` + `ngan` = `htnngan`.
  - `Nguyễn Văn An` → `nv` + `an` = `nvan`.
5. `{mã lớp (không lấy khối)}`:
  - Từ `10A1` → bỏ `10` còn `A1` → normalize thành `a1`.
  - Từ `12A5` → `a5`, v.v.
6. `{niên khóa}`:
  - Khối 10: `2528`.
  - Khối 11: `2427`.
  - Khối 12: `2326`.
7. Ghép username cuối cùng:
  - `username = initials+tenChinh + suffixLop + nienKhoa`.
  - Ví dụ:
    - Nguyễn Minh Luân, 12A3 → `nmluan` + `a3` + `2326` = `nmluana32326`.
    - Huỳnh Thị Ngọc Ngân, 12A5 → `htnngan` + `a5` + `2326` = `htnngana52326`.
    - Nguyễn Văn An, 10A5 → `nvan` + `a5` + `2528` = `nvana52528`.
8. Email:
  - `email = username + "@edusync.edu.vn"`.

> Ghi chú: Quy tắc này đã được kiểm tra lại để khớp với 3 ví dụ bạn đưa ra.

### Chuẩn hóa tiếng Việt

- Dùng hàm `removeVietnameseTones` hoặc tương đương để bỏ dấu và ký tự đặc biệt (có thể tự viết hoặc dùng `unidecode`/`normalize('NFD')`).
- Chỉ giữ [a-z0-9], còn lại thay bằng `""`.

## Mapping khối & lớp

Từ CSV:
- Cột `Khối` có dạng: `"Lớp 10"`, `"Lớp 11"`, `"Lớp 12"`.
- Cột `Lớp` có dạng: `"10A1"`, `"11A1"`, ...

Ta cần:
- Bảng `grades`:
  - Tạo nếu chưa có:
    - `10`, `11`, `12`.
- Bảng `classes`:
  - Khối 10: tên `10A1`..`10A10`, cùng 1 grade `10`.
  - Khối 11: `11A1`..`11A11`, grade `11`.
  - Khối 12: `12A1`..`12A10`, grade `12`.

Lưu ý: Trong yêu cầu có thêm niên khóa:
- 10A* (25-28)
- 11A* (24-27)
- 12A* (23-26)

Hiện `public.classes` không có cột niên khóa, nên ta chỉ encode niên khóa vào email; nếu sau này bảng thêm cột `school_year`, ta có thể update script.

## Luồng tổng thể script seed

Chúng ta sẽ viết một script TypeScript, ví dụ `scripts/seed-students.ts`:

1. **Chuẩn bị Supabase Admin client**
   - Dùng `@supabase/supabase-js` với Service Role Key.
   - URL & KEY lấy từ biến môi trường (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
2. **Đọc CSV**
   - Dùng thư viện `csv-parse` hoặc chính hàm csv parser đã có trong `lib/csv.ts` (nếu phù hợp).
   - Đọc file `../.specific/dshs.csv` (relative từ root repo: `path.resolve(__dirname, "../..", ".specific", "dshs.csv")`).
3. **Seed grades**
   - Lấy về các `grades` hiện có.
   - Upsert 3 bản ghi: `10`, `11`, `12`.
4. **Seed classes**
   - Xây dựng mảng class config:
     - Cho grade 10: range 1..10.
     - Grade 11: 1..11.
     - Grade 12: 1..10.
   - Với mỗi, tạo `name` = `"{grade}A{index}"`.
   - `grade_id` lấy từ `grades` vừa tạo.
   - Upsert vào `public.classes` theo `name` (UNIQUE) để idempotent.
   - Lưu map `{ className -> classId }` để dùng cho student.
5. **Xử lý từng dòng CSV**
   - Parse: `fullName`, `birth`, `khoi`, `lop`.
   - Suy ra `grade` từ `khoi` (10/11/12).
   - Tìm `class_id` qua map ở bước 4.
   - Sinh `email`, `username` bằng hàm helper.
   - Parse `birth` từ định dạng `dd/MM/yyyy` sang ISO `yyyy-MM-dd`.
6. **Tạo auth user**
   - Gọi `supabase.auth.admin.createUser({ email, email_confirm: true, password: '123', user_metadata: { full_name: fullName } })`.
   - Lưu `authUser.id` (UUID) để truy vấn `public.users` sau.
7. **Đợi trigger sync sang public.users**
   - Sau khi `auth.users` inserted, trigger DB sẽ tạo row trong `public.users` với `auth_uid` = `authUser.id`.
   - Script sẽ query `public.users` theo `auth_uid` với retry (ví dụ tối đa 10 lần, mỗi lần sleep 200ms).
8. **Cập nhật public.users & user_profiles**
   - Khi đã có `public.users` row với `id = user_id`:
     - Update `public.users`:
       - `class_id` = class id tương ứng.
     - Update `public.user_profiles` (ON CONFLICT):
       - `full_name` = fullName từ CSV.
       - `date_of_birth` = parsed date.
       - Sử dụng `INSERT ... ON CONFLICT (user_id) DO UPDATE` hoặc `update` nếu chắc chắn đã có.

## Chi tiết cài đặt script

### 1. File & cấu trúc

- Thêm thư mục `scripts/` nếu chưa có.
- Tạo file `scripts/seed-students.ts`.

Bên trong:

- Import:
  - `fs`, `path` từ Node.
  - `createClient` từ `@supabase/supabase-js`.
  - `parse` từ `csv-parse/sync` hoặc sử dụng `lib/csv.ts` tuỳ project.
- Định nghĩa các type nhỏ cho dòng CSV.

### 2. Hàm helper

- `normalizeVietnamese(str: string): string`:
  - Dùng `str.normalize('NFD').replace(/\p{Diacritic}/gu, '')` và lower-case.
  - Cho phép giữ khoảng trắng tạm thời để tách từ; sau đó mới xử lý tiếp.
- `buildEmailAndUsername(fullName: string, classCode: string, gradeLabel: string): { email: string; username: string }`:
  - Xác định niên khoá từ gradeLabel (`10` -> `2528`, `11` -> `2427`, `12` -> `2326`).
  - Chuẩn hoá tên, tách thành các token không dấu, lower-case.
  - Lấy token cuối làm tên chính; lấy chữ cái đầu của từng token phía trước làm initials.
  - `namePart = initials + lastToken`.
  - Tách suffix lớp: từ `"10A1"` lấy `"A1"` → `a1` (bằng regex: `classCode.replace(/^\d+/, '')`).
  - `username = namePart + suffix + yearCode`.
  - `email = `${username}@edusync.edu.vn``.
- `parseDateVn(dateStr: string): string | null`:
  - Input: `"dd/MM/yyyy"`.
  - Rã thành `[d,m,y]`, tạo `new Date(y, m-1, d)`.
  - Trả về `yyyy-MM-dd` (ISO date) hoặc `null` nếu invalid.

### 3. Seeding grades & classes

Pseudo-code:

```ts
const gradeNames = ['10', '11', '12'];
// upsert grades

const { data: existingGrades } = await supabase.from('grades').select('*').in('name', gradeNames);
// build map name -> id

// insert missing

// then build map gradeName -> gradeId

// build classes config
const classesConfig = [];
for (let i = 1; i <= 10; i++) classesConfig.push({ grade: '10', name: `10A${i}` });
for (let i = 1; i <= 11; i++) classesConfig.push({ grade: '11', name: `11A${i}` });
for (let i = 1; i <= 10; i++) classesConfig.push({ grade: '12', name: `12A${i}` });

// Upsert classes by name
```

### 4. Seeding students

Pseudo-code:

```ts
for (const row of csvRows) {
  const fullName = row['Họ và tên'].trim();
  const khoiStr = row['Khối']; // 'Lớp 10', 'Lớp 11', ...
  const className = row['Lớp'].trim(); // '10A1'

  const gradeNumber = khoiStr.match(/\d+/)?.[0];
  if (!gradeNumber) continue;

  const { email, username } = buildEmailAndUsername(fullName, className, gradeNumber);
  const dob = parseDateVn(row['Ngày sinh']);

  // 1. create auth user
  const { data: created, error } = await supabase.auth.admin.createUser({
    email,
    password: '123',
    email_confirm: true,
    user_metadata: { full_name: fullName, class_name: className },
  });

  if (error) { log; continue; }

  const authId = created.user.id; // uuid

  // 2. wait for public.users
  const userRow = await waitForPublicUserByAuthUid(authId);
  if (!userRow) { log; continue; }

  const classId = classMap.get(className);

  // 3. update public.users.class_id
  await supabase.from('users')
    .update({ class_id: classId })
    .eq('id', userRow.id);

  // 4. update public.user_profiles
  if (dob) {
    await supabase.from('user_profiles')
      .update({ full_name: fullName, date_of_birth: dob })
      .eq('user_id', userRow.id);
  } else {
    await supabase.from('user_profiles')
      .update({ full_name: fullName })
      .eq('user_id', userRow.id);
  }
}
```

`waitForPublicUserByAuthUid` sẽ query với retry nhỏ để đảm bảo trigger đã chạy.

### 5. Xử lý idempotent & log

- Có thể kiểm tra trước xem `auth.users` đã có email đó chưa, nếu rồi thì bỏ qua.
- Hoặc khi `createUser` báo conflict, thì GET lại user theo email.
- Log lỗi ra console để sau này xem lại.

## Cách chạy script (dự kiến)

- Thêm dev dependency:
  - `@supabase/supabase-js`
  - `csv-parse`
  - (tuỳ chọn) `tsx` để chạy TS trực tiếp.
- Script chạy bằng:

```bash
npx tsx scripts/seed-students.ts
```

- Biến môi trường cần:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

## Bước tiếp theo

1. Tạo file `scripts/seed-students.ts` theo plan này.
2. Kết nối Supabase admin client.
3. Cài đặt helper functions (normalize tên, parse ngày, build email/username).
4. Implement seeding grades + classes.
5. Implement seeding học sinh từ CSV.
6. Test thử trên một vài dòng CSV (subset) trước khi chạy full.
