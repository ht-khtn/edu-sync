-- Seed dữ liệu cho bảng criteria
-- Chạy file này trong dự án Supabase (SQL editor) sau khi tạo bảng.
-- Lưu ý: cột score là điểm dương (sẽ được map thành points âm ở frontend khi nhập vi phạm).

insert into public.criteria (name, description, type, score, category, "group", subgroup, is_active)
values
  ('Không đúng đồng phục', 'Học sinh mặc sai hoặc thiếu đồng phục quy định', 'normal', 2, 'student', 'Nề nếp', 'Đồng phục', true),
  ('Đi học trễ', 'Học sinh vào lớp sau giờ quy định', 'normal', 1, 'student', 'Nề nếp', 'Đúng giờ', true),
  ('Không làm bài tập', 'Không hoàn thành bài tập được giao', 'normal', 1, 'student', 'Học tập', 'Bài tập', true),
  ('Không thẻ học sinh', 'Quên hoặc mất thẻ học sinh khi đến trường', 'normal', 2, 'student', 'Nề nếp', 'Giấy tờ', true),
  ('Mất trật tự', 'Gây ồn ào, ảnh hưởng lớp học hoặc khu vực chung', 'normal', 1, 'class', 'Nề nếp', 'Trật tự', true),
  ('Tập thể không vệ sinh lớp', 'Cả lớp không dọn dẹp sau giờ học', 'serious', 3, 'class', 'Nề nếp', 'Vệ sinh', true);

-- Có thể bổ sung thêm hạng mức nghiêm trọng (serious, critical) sau:
-- insert into public.criteria (name, description, type, score, category, "group", subgroup) values
-- ('Xâm hại tài sản', 'Làm hư hỏng tài sản trường/lớp', 'serious', 5, 'student', 'Kỷ luật', 'Tài sản');
