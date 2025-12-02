-- Seed dữ liệu cho bảng criteria
-- Chạy file này trong dự án Supabase (SQL editor) sau khi tạo bảng.
-- Lưu ý: cột score là điểm dương (sẽ được map thành points âm ở frontend khi nhập vi phạm).

insert into public.criteria (name, description, type, score, category)
values
  ('Không đúng đồng phục', 'Học sinh mặc sai hoặc thiếu đồng phục quy định', 'normal', 2, 'nề nếp'),
  ('Đi học trễ', 'Học sinh vào lớp sau giờ quy định', 'normal', 1, 'nề nếp'),
  ('Không làm bài tập', 'Không hoàn thành bài tập được giao', 'normal', 1, 'học tập'),
  ('Không thẻ học sinh', 'Quên hoặc mất thẻ học sinh khi đến trường', 'normal', 2, 'nề nếp'),
  ('Mất trật tự', 'Gây ồn ào, ảnh hưởng lớp học hoặc khu vực chung', 'normal', 1, 'nề nếp');

-- Có thể bổ sung thêm hạng mức nghiêm trọng (serious, critical) sau:
-- insert into public.criteria (name, description, type, score, category) values
-- ('Xâm hại tài sản', 'Làm hư hỏng tài sản trường/lớp', 'serious', 5, 'kỷ luật');
