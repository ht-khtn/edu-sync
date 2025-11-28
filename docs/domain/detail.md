# MỤC LỤC
* Phần thứ nhất. Các tác giả của giải pháp dự thi 2
* Phần thứ hai. Thuyết minh về giải pháp dự thi 3
  * I. CƠ SỞ VÀ MỤC TIÊU NGHIÊN CỨU 3
    * 1. Cơ sở nảy sinh ý tưởng nghiên cứu 3
    * 2. Mục tiêu nghiên cứu 4
  * II. PHƯƠNG PHÁP, KẾ HOẠCH VÀ DỰ KIẾN KẾT QUẢ NGHIÊN CỨU 4
    * 1. Phương pháp nghiên cứu 4
      * 1.1. Phương pháp nghiên cứu tài liệu: 4
      * 1.2. Phương pháp khảo sát và phỏng vấn: 4
      * 1.3. Phương pháp thiết kế và phát triển hệ thống: 5
      * 1.4. Phương pháp thực nghiệm và đánh giá: 5
    * 2. Kế hoạch tổ chức nghiên cứu 5
    * 3. Dự kiến kết quả nghiên cứu 5
      * 3.1. Tổng quan hệ thống 5
      * 3.2. Dự kiến về kỹ thuật 6
        * 3.2.1. Tổng quan kỹ thuật 6
        * 3.2.2. Giao diện và thiết kế người dùng 7
        * 3.2.3. Hệ thống backend & CSDL 7
        * 3.2.4. Phân quyền người dùng 7
        * 3.2.5. Triển khai 8
        * 3.2.6. Bảo mật và lưu trữ 8
        * 3.2.7. Các tính năng kỹ thuật khác 8
      * 3.3. Dự kiến về tính năng 9
        * 3.3.1. Quản lý phong trào 9
        * 3.3.2. Quản lý thi đua 10
        * 3.3.3. Tính năng module khác 11
  * III. GIÁ TRỊ VÀ KHẢ NĂNG ỨNG DỤNG CỦA ĐỀ TÀI 12
    * 1. Tính mới 12
    * 2. Tính khả thi 12
    * 3. Tính ứng dụng 12
      * 3.1. Hiệu quả kinh tế 12
      * 3.2. Hiệu quả xã hội 13
  * IV. KẾT LUẬN 13
* Phụ lục 1. Tổng quan về công nghệ sử dụng 14
* Phụ lục 2. Bảng giải thích các thuật ngữ sử dụng 15

---
CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập – Tự do – Hạnh phúc
---

# EDUSYNC – HỆ THỐNG HỖ TRỢ QUẢN LÝ PHONG TRÀO VÀ THI ĐUA DÀNH CHO CÁC TRƯỜNG THPT
---------
## Phần thứ nhất. Các tác giả của giải pháp dự thi
* GVHD: Bùi Bích Thủy
* Danh sách tác giả:

| TT | Họ và tên | Ngày sinh | Lớp | Số điện thoại | Nhóm trưởng | Đóng góp |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Nguyễn Minh Luân | 26/08/2008 | 12A3 | 0704941701 | X | 60% |
| 2 | Thái Trương Y Phương | 10/01/2008 | 12A4 | 0788967539 | | 40% |

## Phần thứ hai. Thuyết minh về giải pháp dự thi
### I. CƠ SỞ VÀ MỤC TIÊU NGHIÊN CỨU
#### 1. Cơ sở nảy sinh ý tưởng nghiên cứu
Trong bối cảnh chuyển đổi số đang trở thành xu thế tất yếu trong lĩnh vực giáo dục, việc ứng dụng công nghệ thông tin vào công tác quản lý và điều hành nhà trường ngày càng được quan tâm.

Tuy nhiên, thực tế tại nhiều trường trung học phổ thông hiện nay cho thấy công tác quản lý phong trào và thi đua vẫn còn mang tính thủ công, rời rạc và thiếu tính hệ thống.

Hầu hết các hoạt động như ghi nhận vi phạm, cộng – trừ điểm thi đua, tổng hợp báo cáo đều được thực hiện qua sổ sách giấy tờ, bảng tính Excel hoặc Google Sheet riêng lẻ.

Cách làm này không chỉ tốn nhiều thời gian và công sức của giáo viên, mà còn dễ dẫn đến sai sót, thất lạc dữ liệu, chồng chéo giữa các ban phụ trách, và đặc biệt là thiếu tính minh bạch trong quá trình chấm điểm thi đua.

Bên cạnh đó, việc tổng hợp điểm thi đua định kỳ thường gặp nhiều khó khăn, nhất là đối với các trường có số lượng lớp lớn.

Nhiều trường hợp xảy ra tình trạng dữ liệu bị trùng lặp, mâu thuẫn hoặc không có bằng chứng xác thực, khiến công tác kiểm tra – đối chiếu trở nên phức tạp.

Học sinh và tập thể lớp thường chỉ được thông báo kết quả khi đã tổng kết, không có cơ hội theo dõi tiến độ hay phản hồi về các điểm cộng – trừ cụ thể.

Điều này làm giảm tính công bằng, khách quan và động lực thi đua trong học sinh.

Không chỉ vậy, việc quản lý dữ liệu thi đua hiện nay còn tiềm ẩn nguy cơ mất an toàn thông tin.

Nhiều bảng tính chia sẻ nội bộ không có cơ chế phân quyền rõ ràng, dẫn đến khả năng chỉnh sửa sai lệch, rò rỉ dữ liệu học sinh hoặc xóa nhầm không thể khôi phục.

Hệ thống quản lý hiện hành cũng chưa có cơ chế xác thực danh tính người nhập liệu, khiến việc kiểm soát và truy vết gặp khó khăn.

Từ thực trạng đó, nhóm nghiên cứu nhận thấy cần thiết phải xây dựng một hệ thống số hóa đồng bộ giúp tự động hóa quy trình quản lý phong trào và thi đua trong các trường THPT.

Hệ thống được đề xuất với mục tiêu giải quyết những hạn chế nêu trên bằng cách tích hợp các chức năng: ghi nhận vi phạm và điểm thưởng theo thời gian thực, lưu trữ dữ liệu tập trung, tự động thống kê và xếp hạng, đồng thời cho phép học sinh, Ban thi đua, cũng như Ban Chấp hành theo dõi tiến độ minh bạch qua giao diện trực quan.

Với những lý do trên, nhóm nghiên cứu lựa chọn đề tài “EduSync – Hệ thống Hỗ trợ Quản lý Phong trào và Thi đua dành cho các trường THPT” với kỳ vọng không chỉ góp phần giải quyết các vấn đề thực tiễn trong công tác quản lý nhà trường, mà còn đóng góp vào quá trình chuyển đổi số ngành giáo dục, hướng tới một mô hình quản lý thông minh, hiệu quả và minh bạch hơn trong tương lai.

#### 2. Mục tiêu nghiên cứu
Mục tiêu của dự án EduSync – Hệ thống hỗ trợ quản lý phong trào và thi đua cho trường THPT là xây dựng một nền tảng số giúp Ban Chấp hành, Ban Thi đua và học sinh quản lý, theo dõi, đánh giá hiệu quả các hoạt động phong trào – thi đua trong trường.

Ứng dụng hướng đến việc số hóa và chuẩn hóa quy trình thi đua, bảo đảm minh bạch, công bằng, chính xác;

đồng thời tăng cường khả năng phối hợp, tương tác và lưu trữ dữ liệu giữa các bộ phận trong nhà trường.

Ngoài giá trị công nghệ, dự án còn góp phần thúc đẩy tinh thần tự quản, sáng tạo, đoàn kết học đường, giúp học sinh phát huy năng lực cá nhân và tập thể, xây dựng môi trường học đường năng động, công bằng và tích cực.

Các mục tiêu cụ thể của EduSync:
* Thiết kế giao diện thân thiện, dễ sử dụng cho học sinh và các ban điều hành.
* Phát triển ứng dụng web thống nhất về trải nghiệm người dùng.
* Xây dựng cơ sở dữ liệu tập trung để lưu trữ, xử lý và đồng bộ dữ liệu thi đua – phong trào an toàn, hiệu quả.
* Áp dụng mô hình phân quyền người dùng (RBAC) phù hợp với cơ cấu tổ chức của riêng các trường.
* Phát triển các module chính: nhập/chấm điểm phong trào, theo dõi tiến độ, tổng hợp, xếp hạng và duyệt kết quả nhiều cấp.
* Tích hợp tự động hóa trong tính điểm, thống kê, tổng kết nhằm giảm sai sót, tiết kiệm thời gian, nâng cao hiệu suất.
* Tăng cường bảo mật qua nhiều lớp kỹ thuật bảo vệ dữ liệu.
* Khảo sát và đánh giá hiệu quả thực tế khi thử nghiệm tại trường, từ đó đề xuất hướng hoàn thiện và mở rộng hệ thống.

### II. PHƯƠNG PHÁP, KẾ HOẠCH VÀ DỰ KIẾN KẾT QUẢ NGHIÊN CỨU
#### 1. Phương pháp nghiên cứu
##### 1.1. Phương pháp nghiên cứu tài liệu:
* Thu thập, phân tích các tài liệu về mô hình quản lý phong trào – thi đua hiện nay tại các trường THPT.
* Tham khảo các hệ thống quản lý giáo dục hiện có (như SMAS, VietSchool,…) để xác định điểm mạnh, điểm yếu và khả năng tích hợp.
##### 1.2. Phương pháp khảo sát và phỏng vấn:
* Tiến hành khảo sát thực tế tại trường THPT (Ban Chấp hành, Ban Thi đua, học sinh) để xác định nhu cầu, khó khăn và kỳ vọng trong công tác quản lý phong trào.
* Phỏng vấn nhóm đại diện nhằm thu thập dữ liệu định tính phục vụ cho việc thiết kế tính năng và quy trình vận hành.
##### 1.3. Phương pháp thiết kế và phát triển hệ thống:
* Sử dụng mô hình SDLC (Software Development Life Cycle) theo hướng Agile để phát triển tuần tự qua các giai đoạn: phân tích – thiết kế – lập trình – kiểm thử – hoàn thiện.
* Áp dụng công nghệ Node.js cho giao diện đa nền tảng và Supabase (PostgreSQL) cho cơ sở dữ liệu cùng hệ thống phân quyền RBAC (Xem Phụ lục 1).
##### 1.4. Phương pháp thực nghiệm và đánh giá:
* Thử nghiệm hệ thống tại một trường THPT để thu thập phản hồi người dùng thật.
* Đánh giá hiệu quả dựa trên tiêu chí: độ chính xác, tốc độ xử lý, tính thân thiện và mức độ hài lòng của người dùng.

#### 2. Kế hoạch tổ chức nghiên cứu
Đề tài được triển khai theo 4 giai đoạn chính, kéo dài từ tháng 6/2025 đến tháng 11/2025, cụ thể như sau:

**2.1. Giai đoạn 1 – Khảo sát và phân tích yêu cầu (6/2025 – 9/2025):**
* Khảo sát thực tế hoạt động phong trào, thi đua tại các trường THPT.
* Thu thập thông tin từ Ban Chấp hành, Ban Thi đua và học sinh.
* Phân tích quy trình nghiệp vụ, xác định các yêu cầu chức năng và phi chức năng của hệ thống.

**2.2. Giai đoạn 2 – Thiết kế và xây dựng hệ thống (9/2025 – 11/2025):**
* Thiết kế cơ sở dữ liệu và mô hình phân quyền người dùng (RBAC).
* Xây dựng giao diện đa nền tảng bằng Node.js.
* Kết nối backend Supabase, triển khai các module chính: nhập điểm, theo dõi thi đua, tổng hợp – xếp hạng.
* Tích hợp tính năng bảo mật và tối ưu hóa hiệu suất hệ thống.

**2.3. Giai đoạn 3 – Kiểm thử và hiệu chỉnh (11/2025):**
* Tiến hành kiểm thử toàn diện về chức năng, hiệu năng và bảo mật hệ thống.
* Thu nhận phản hồi từ người dùng thử, chỉnh sửa lỗi và cải thiện trải nghiệm.

**2.4. Giai đoạn 4 – Hoàn thiện và báo cáo kết quả (11/2025):**
* Tổng hợp kết quả thử nghiệm và đánh giá hiệu quả thực tế.
* Hoàn thiện sản phẩm cuối cùng, viết báo cáo tổng kết và đề xuất hướng phát triển.

#### 3. Dự kiến kết quả nghiên cứu
Sau quá trình nghiên cứu và phát triển, nhóm dự án đã hoàn thiện mô hình tổng thể hệ thống EduSync, bao gồm kiến trúc kỹ thuật, mô hình dữ liệu, cơ chế bảo mật và quy trình quản trị người dùng, có khả năng triển khai thực tế tại các trường THPT.

##### 3.1. Tổng quan hệ thống
| Tên hệ thống | EduSync – Hệ thống Hỗ trợ Quản lý Phong trào và Thi đua dành cho các trường THPT |
| :--- | :--- |
| Mô hình hệ thống | Client–Server (đa nền tảng) |
| Kiến trúc tổng thể | - Frontend<br>- Backend<br>- Edge Functions<br>- Database |
| Nền tảng phát triển | Web |
| "Nền tảng, ngôn ngữ thực hiện" | - Frontend: Next.js<br>- Backend, Edge Functions: Supabase<br>- Database: PostgreSQL |
| Bảo mật hệ thống | - Row-Level Security (RLS) trên Supabase<br>- HTTPS bắt buộc<br>- JWT Authentication<br>- AES/RSA Encryption cho dữ liệu nhạy cảm |
| Phiên bản hệ điều hành hỗ trợ | "Windows 10/11, tất cả trình duyệt Chromium-based" |
| Giao diện người dùng (UI/UX) | "Shadcn/ui, TaiwindCSS, tông màu pastel, responsive, đa ngôn ngữ (Việt/Anh)" |
| Công cụ phát triển | - Visual Studio Code: IDE lập trình chính<br>- Next.js SDK: Hỗ trợ lập trình ngôn ngữ Next.js<br>- Supabase CLI: Tương tác với backend<br>- GitHub: Quản lý phiên bản dự án<br>- Vercel: Triển khai dự án |
| Giới hạn truy cập | "Tối đa 1.000.000 lượt truy cập/ tháng, 5.000 tài khoản/ tháng" |
| Giấy phép và sở hữu trí tuệ | Sử dụng công nghệ mã nguồn mở (như MIT License cho các thư viện chính) |

##### 3.2. Dự kiến về kỹ thuật
###### 3.2.1. Tổng quan kỹ thuật
Hệ thống EduSync – Hệ thống Hỗ trợ Quản lý Phong trào và Thi đua dành cho các trường THPT được phát triển dựa trên kiến trúc client–server hiện đại, kết hợp giữa khả năng xử lý mạnh mẽ của Next.js và hệ quản trị cơ sở dữ liệu PostgreSQL do nền tảng Supabase cung cấp.

Mục tiêu của kiến trúc này là đạt được ba tiêu chí cốt lõi: tốc độ – ổn định – bảo mật, đồng thời đảm bảo khả năng mở rộng và triển khai linh hoạt trong môi trường học đường

EduSync hoạt động theo mô hình ba lớp:
* **Frontend (Client Layer):** được phát triển bằng Next.js (React framework), sử dụng song song SSR (Server-Side Rendering) và CSR (Client-Side Rendering) nhằm tối ưu tốc độ tải, cải thiện trải nghiệm người dùng.
* **Backend (Application Layer):** được xử lý thông qua Supabase Edge Functions, đóng vai trò như các API serverless phục vụ nghiệp vụ phức tạp (ví dụ: tính điểm thi đua, kiểm duyệt, thống kê, phân quyền).
* **Database (Data Layer):** được quản lý bằng PostgreSQL, cung cấp khả năng lưu trữ dữ liệu quan hệ, bảo đảm tính toàn vẹn (referential integrity) và độ an toàn cao nhờ cơ chế RLS (Row Level Security).

###### 3.2.2. Giao diện và thiết kế người dùng
Ở phần frontend, ứng dụng sử dụng Next.js – framework mạnh mẽ dựa trên React và TypeScript, hỗ trợ linh hoạt Server-side Rendering (SSR) và Client-side Rendering (CSR).

Nhờ đó, giao diện EduSync tải nhanh, phản hồi tốt và tối ưu trải nghiệm người dùng.

Giao diện được phát triển bằng shadcn/ui và Tailwind CSS, mang phong cách tối giản, hiện đại, thống nhất, giúp tăng tốc phát triển và dễ tùy biến theo từng trường.Ứng dụng tích hợp Framer Motion để tạo hiệu ứng chuyển động mượt mà, tăng tính trực quan, và được triển khai dưới dạng Progressive Web App (PWA), có thể cài đặt như ứng dụng native và hoạt động ngoại tuyến nhờ cơ chế offline caching.

###### 3.2.3. Hệ thống backend & CSDL
Ở phần backend, hệ thống được xây dựng trên nền tảng Supabase, một dịch vụ Backend-as-a-Service (BaaS) mã nguồn mở hoạt động dựa trên cơ sở dữ liệu PostgreSQL.

Supabase cung cấp các tính năng cốt lõi như:
* **Supabase Auth:** xác thực và quản lý tài khoản người dùng.
* **Supabase Realtime:** đồng bộ dữ liệu thi đua theo thời gian thực.
* **Supabase Storage:** lưu trữ tệp minh chứng, hình ảnh hoạt động.
* **Supabase Edge Functions:** xử lý nghiệp vụ phức tạp

Cấu trúc cơ sở dữ liệu được thiết kế xoay quanh ba nhóm chính:
* **Nhóm dữ liệu người dùng (User Data)** – lưu trữ thông tin tài khoản, vai trò, trạng thái hoạt động, và quyền truy cập tương ứng.
* **Nhóm dữ liệu thi đua – phong trào (Competition & Campaign Data)** – bao gồm các bảng quản lý sự kiện, tiêu chí chấm điểm, điểm số, và lịch sử duyệt/xếp hạng.
* **Nhóm dữ liệu hệ thống (System Logs & Analytics)** – ghi nhận hoạt động, thay đổi dữ liệu và kết quả thống kê tổng hợp.

###### 3.2.4. Phân quyền người dùng
Hệ thống phân quyền người dùng được xây dựng dựa trên mô hình RBAC (Role-Based Access Control), đảm bảo rõ ràng trong quyền hạn và trách nhiệm của từng vai trò.

Các vai trò cụ thể như sau:

| Cấp độ | Vai trò | Tên đầy đủ | "Phạm vi, quyền hạn" |
| :--- | :--- | :--- | :--- |
| Hệ thống | AD | Quản trị hệ thống toàn cục | Toàn bộ hệ thống |
| Trường | MOD | Quản trị hệ thống của trường | - Quản lý hệ thống 1 trường<br>- Thiết lập quy tắc thi đua của trường<br>- Quản lý chung các vai trò |
| | SEC | Ban chấp hành Đoàn trường | "- Phát động phong trào, sự kiện"<br>- Quản lý phân cấp BCH Chi đoàn<br>- Phân quyền Ban thi đua lại mỗi tháng<br>"- Giải quyết các phản hồi về thi đua, phong trào" |
| Lớp | CC | Ban thi đua | - Quản lý thi đua tại lớp mình được phân công<br>- Sau khi nhập không có quyền chỉnh sửa mà cần yêu cầu lên Trưởng ban thi đua |
| | CEC | Ban chấp hành Chi đoàn | "- Đánh dấu, điểm danh sự tham gia của các thành viên lớp đối với các phong trào"<br>- Xem danh sách vi phạm của lớp<br>"- Gửi khiếu nại, phản hồi về thi đua, phong trào" |
| Cá nhân | YUM | Đoàn viên | - Bao gồm toàn bộ quyền của Học sinh<br>- Tham gia các phong trào chỉ dành cho đoàn viên |
| | S | Học sinh | - Tham gia các phong trào phát động chung<br>- Xem danh sách vi phạm của bản thân |
| Khác | Tự do | "(Không thuộc các nhóm trên, được cung cấp quyền hạn tùy vào chức năng)" | "VD: Khối trưởng, Trưởng ban thi đua, v.v" |

###### 3.2.5. Triển khai
Về triển khai, EduSync được host trên Vercel – nền tảng chuyên dụng cho các ứng dụng Next.js, hỗ trợ CI/CD tự động và đồng bộ trực tiếp với GitHub.

Mỗi khi có thay đổi trong mã nguồn, hệ thống tự động build và triển khai bản cập nhật mới, giúp việc kiểm thử và phát hành diễn ra liên tục, nhanh chóng.

###### 3.2.6. Bảo mật và lưu trữ
Về bảo mật và quản lý dữ liệu, EduSync sử dụng HTTPS để mã hóa giao tiếp và JWT để bảo vệ phiên đăng nhập, đảm bảo thông tin xác thực được lưu trữ an toàn.

Dữ liệu được quản lý trong PostgreSQL với Row Level Security (RLS), giới hạn truy cập theo quyền người dùng.

Hệ thống áp dụng Soft Delete để cho phép khôi phục dữ liệu đã xóa, bảo toàn lịch sử thi đua – phong trào.

Toàn bộ hoạt động của người dùng đều được ghi log và bảo mật trong cơ sở dữ liệu, bảo đảm tính minh bạch và chính xác.

###### 3.2.7. Các tính năng kỹ thuật khác
Để đáp ứng tính linh động, phù hợp với thực tiễn của từng trường học, cũng như khắc phục một số vấn đề kỹ thuật về mạng, hệ thống EduSync còn sử dụng một số kỹ thuật khác nhau như cơ chế RBAC, kỹ thuật module, cơ chế Offline Caching, v.v.

Cụ thể như sau.

*** Khả năng mở rộng vai trò**
Hệ thống EduSync được thiết kế theo cơ chế RBAC (Role-Based Access Control), cho phép phân quyền rõ ràng, linh hoạt và mở rộng được các vai trò mới trong tương lai.
Các vai trò mặc định đã được trình bày ở mục 3.2.4.
Cấu trúc RBAC cho phép:
* Thêm vai trò mới thông qua phân quyền tự do, đảm bảo sự linh hoạt, thích ứng với cơ câu nhà trường.
* Cấp quyền tạm thời hoặc tùy biến cho các vai trò hiện có.
* Điều chỉnh quyền hạn chi tiết theo từng module hoặc chức năng, đảm bảo mỗi người chỉ thao tác với dữ liệu và tính năng thuộc phạm vi nhiệm vụ của họ.
Nhờ đó, hệ thống linh hoạt mở rộng khi trường học thay đổi cơ cấu tổ chức, hoặc khi yêu cầu nghiệp vụ mới phát sinh, không làm gián đoạn hoạt động hiện tại.

*** Khả năng mở rộng tính năng**
EduSync được phát triển theo kiến trúc module, trong đó mỗi chức năng tách biệt nhưng liên kết chặt chẽ, giúp dễ dàng bổ sung hoặc nâng cấp mà không ảnh hưởng toàn hệ thống.
Mô hình này cho phép mở rộng với các module mới như quản lý điểm rèn luyện, hồ sơ học sinh hoặc đồng bộ dữ liệu với hệ thống khác.
Hệ thống có thể tích hợp các công cụ nâng cao như phân tích dữ liệu, AI gợi ý phong trào, hoặc báo cáo trực quan.
Nhờ sử dụng Next.js, Supabase và Edge Functions, mỗi module được bảo trì độc lập, triển khai nhanh và ổn định qua Vercel.

*** Khả năng ngoại tuyến**
Để khắc phục hạn chế truy cập mạng, EduSync hỗ trợ Offline Caching thông qua PWA, cho phép nhập và lưu dữ liệu khi ngoại tuyến;
thông tin sẽ tự động đồng bộ lên hệ thống khi có kết nối Internet.

##### 3.3. Dự kiến về tính năng
###### 3.3.1. Quản lý phong trào
Tính năng Quản lý Phong trào là một trong hai phần cốt lõi của EduSync, giúp Ban Chấp hành và Ban Thi đua quản lý toàn bộ các hoạt động phong trào trong trường một cách trực quan, minh bạch và hiệu quả.

Mục tiêu của module là số hóa quy trình quản lý phong trào, từ việc tạo mới hoạt động, theo dõi tiến độ đến tổng hợp kết quả và báo cáo.

Module này hoạt động theo phương pháp top-down, tức là triển khai từ cấp cao đến các cấp thấp hơn.

*** Tạo và quản lý hoạt động:**
Đầu tiên, BCH Đoàn trường tạo mới các hoạt động phong trào với đầy đủ thông tin: tên hoạt động, mô tả, thời gian, địa điểm, số lượng học sinh tham gia dự kiến và tiêu chí đánh giá.
Hệ thống cho phép:
* Chỉnh sửa hoạt động: cập nhật thông tin khi thay đổi thời gian, địa điểm, hoặc tiêu chí cộng điểm.
* Hủy hoặc tạm dừng: đánh dấu hoạt động không còn diễn ra, dữ liệu vẫn được lưu để phục hồi khi cần (Soft Delete).
* Đính kèm tài liệu liên quan: phiếu đăng ký, hướng dẫn hoặc hình ảnh minh họa.
Xét theo tính bắt buộc, có thể chia làm 02 loại hoạt động như sau:
* Hoạt động bắt buộc: thường được triển khai đến ĐVTN thông qua văn bản, kế hoạch, hướng dẫn kèm theo.
* Hoạt động tự nguyện: ngoài việc triển khai các văn bản liên quan, còn cho phép ĐVTN đăng ký trực tiếp trên web.

*** Quản lý thành viên và phân quyền**
Mỗi hoạt động có thể được triển khai chung hoặc gắn với một nhóm học sinh cụ thể, chẳng hạn như chỉ dành cho một lớp, hoặc chỉ dành cho đoàn viên.
Ngoài ra, BCH Đoàn trường cũng có thể quản lý các thành viên của BTC, tổ kỹ thuật, tổ hậu cần, tổ điểm danh, v.v.
Cơ chế này dựa trên RBAC, cho phép linh hoạt cấp quyền tạm thời cho thành viên hỗ trợ mà không cần tạo tài khoản cố định, giúp tăng khả năng vận hành nhóm linh hoạt.

*** Theo dõi tiến độ và hiển thị dữ liệu:**
Module cung cấp dashboard tổng quan hoạt động, hiển thị:
* Danh sách các phong trào đang diễn ra, đã hoàn thành hoặc tạm dừng.
* Biểu đồ trực quan về số lượng học sinh tham gia theo lớp, tổng điểm theo nhóm, mức độ hoàn thành so với kế hoạch.
* Cảnh báo hoặc nhắc nhở cho các hoạt động sắp diễn ra, chưa cập nhật kết quả hoặc sắp kết thúc.
Các bảng thống kê và biểu đồ được xây dựng bằng thư viện trực quan dễ hiểu, hỗ trợ người dùng không chuyên về công nghệ nắm bắt tình hình ngay lập tức.

*** Nhập và tính điểm**
Trong trường hợp bình thường, có thể nhập dữ liệu về số lượng học sinh tham gia, kết quả thực hiện nhiệm vụ hoặc điểm cá nhân/tập thể.
Ngoài ra, có một số phong trào, hoạt động sẽ được phân công 1 tổ kiểm tra riêng, tùy theo BCH Đoàn Trường.
(Vui lòng xem mục 3.3.2. để biết thêm cách thức nhập điểm và thống kê).

###### 3.3.2. Quản lý thi đua
Module Quản lý Thi đua là phần xương sống của toàn bộ dự án.

Tính năng này được thiết kế để tính điểm thi đua dựa trên tổng hợp các hoạt động tích cực của học sinh và các vi phạm, giúp Ban Chấp hành và Ban Thi đua quản lý công bằng, minh bạch và kịp thời toàn bộ thông tin thi đua trong trường THPT.

Module này vận hành dựa trên mối liên kết trực tiếp với hệ thống quản lý vi phạm của trường, đảm bảo mỗi hành vi của học sinh, dù tích cực hay tiêu cực, đều được phản ánh đúng trong điểm thi đua.

Trái ngược với module Quản lý phong trào, module này được thiết kế theo phương pháp bottom-up, ghi nhận và tổng hợp từ cấp thấp rồi dần đến cấp cao hơn.

*** Tạo các quy chế thi đua**
Đầu tiên, quy chế thi đua sẽ do Moderator của từng trường tạo ra để phù hợp với yêu cầu của mỗi trường.
Hệ thống cho phép thay đổi, chỉnh sửa, cũng như xóa các quy tắc để đảm bảo tính linh động trong quản lý.

*** Ghi nhận thi đua**
Ban thi đua sẽ được BCH Đoàn trường phân vào các lớp.
Mỗi Ban thi đua của một lớp chỉ được phân quyền để quản lý duy nhất một lớp đó.
Có thể linh động điều chỉnh sau một khoảng thời gian nhất định để phù hợp với yêu cầu của Đoàn trường.
Ngoài ra, để đảm bảo tính minh bạch, Ban thi đua sẽ không có quyền chỉnh sửa sau khi đã nhập.
Nếu muốn chỉnh sửa, phải gửi yêu cầu lên Trưởng ban thi đua để giải quyết.
Bên cạnh đó, để đảm bảo tính chính xác của việc thi đua, BCH Chi đoàn sẽ phối hợp kiểm tra các dữ liệu của ban thi đua nhập vào, và được quyền khiếu nại, phản hồi khi có sai sót xảy ra.
Sau khi nhập điểm, hệ thống sẽ:
* Tự động tính điểm tổng hợp theo tiêu chí đã định sẵn.
* Cập nhật bảng thống kê tổng hợp ngay khi dữ liệu thay đổi, tránh sai sót.
* Hỗ trợ tải file CSV để nhập số liệu hàng loạt, giảm thời gian thao tác.

*** Duyệt kết quả và kiểm soát dữ liệu**
Sau khi Ban thi đua đã nhập điểm, Trưởng ban thi đua sẽ duyệt lại các kết quả thi đua, bao gồm:
* Kiểm tra tính hợp lệ và chính xác của dữ liệu, đảm bảo mọi vi phạm và thành tích đều được phản ánh đúng.
* Có toàn quyền chỉnh sửa hoặc xóa, thêm dữ liệu nếu phát hiện sai sót
* Hệ thống tự động đồng bộ các thay đổi lên bảng tổng hợp và dashboard hiển thị, đảm bảo thông tin được cập nhật ngay lập tức.

*** Báo cáo, thống kê và xếp hạng**
Module cung cấp các bảng thống kê, biểu đồ trực quan theo nhiều tiêu chí:
* Theo lớp, khối hoặc cá nhân.
* Tổng hợp điểm dựa trên thành tích và vi phạm.
* Theo mốc thời gian cụ thể (tuần, tháng, quý).
Người dùng có thể xuất báo cáo dưới dạng CSV hoặc PDF, với khả năng tùy biến cao, để lưu trữ hoặc phục vụ đánh giá chính thức.
Dashboard cũng hiển thị cảnh báo khi học sinh gần đạt mức vi phạm cần nhắc nhở hoặc khi điểm thi đua được cập nhật.

###### 3.3.3. Tính năng module khác
Với thiết kế module linh hoạt, EduSync có thể dễ dàng mở rộng tính năng theo nhu cầu thực tế của từng trường, như thêm module thi trực tuyến hoặc đường lên đỉnh Olympia ngay trên hệ thống.

Dự án cũng cung cấp bộ file mẫu quản lý chuẩn hóa, giúp Ban Chấp hành các cấp thống nhất và linh hoạt trong việc lập hồ sơ, tài liệu.

### III. GIÁ TRỊ VÀ KHẢ NĂNG ỨNG DỤNG CỦA ĐỀ TÀI
#### 1. Tính mới
EduSync mang tính mới cả về công nghệ lẫn phương pháp quản lý.

Đây là hệ thống số hóa đầu tiên dành cho công tác thi đua – phong trào trong trường THPT, tích hợp quản lý vi phạm, tính điểm và xếp hạng theo thời gian thực.

Ứng dụng các công nghệ hiện đại như Next.js, Supabase, Edge Functions, RBAC, PWA, cùng cơ chế Realtime, Offline Caching và Incremental Static Regeneration (ISR), hệ thống đảm bảo truy cập linh hoạt, ổn định, mượt mà.

Điểm nổi bật là tự động tính điểm thi đua, mở rộng vai trò người dùng và bổ sung tính năng mới qua cơ chế module, giúp hệ thống thích ứng linh hoạt với nhu cầu quản lý và phát triển trong tương lai.

#### 2. Tính khả thi
Dự án có tính khả thi cao nhờ các yếu tố sau:
* Công nghệ hiện đại, phổ biến: Sử dụng Next.js, Supabase, Vercel, giúp triển khai nhanh, bảo trì dễ.
* Triển khai thực tế: Hoạt động như PWA, chạy hoàn toàn trên web, có chế độ offline, phù hợp hạ tầng trường học.
* Quy trình phát triển hợp lý: Thực hiện theo mô hình Agile SDLC, gồm các giai đoạn khảo sát, xây dựng, kiểm thử và hoàn thiện.
* Quản lý dữ liệu hiệu quả: Dùng PostgreSQL, Edge Functions, RLS, RBAC để đảm bảo bảo mật và mở rộng linh hoạt.
* Chi phí thấp: Supabase và Vercel có gói miễn phí dung lượng cao, đáp ứng tốt nhu cầu vận hành của một trường học.

#### 3. Tính ứng dụng
EduSync có tính ứng dụng cao trong môi trường học đường:
* Đối với Ban Chấp hành và Ban Thi đua: Giảm tải công việc nhập liệu, tính điểm, duyệt kết quả và tổng hợp báo cáo thủ công.
* Đối với học sinh: Tăng tính minh bạch, công bằng trong thi đua, dễ theo dõi thành tích và vi phạm, khuyến khích hành vi tích cực.
* Đối với nhà trường: Cung cấp công cụ quản lý toàn diện, hỗ trợ ra quyết định dựa trên dữ liệu, cải thiện hiệu quả tổ chức phong trào.
* Mở rộng trong tương lai: Dễ dàng thêm module mới như quản lý hồ sơ học sinh, điểm rèn luyện, tích hợp với VNeID, SMAS, hoặc các công cụ phân tích nâng cao.

##### 3.1. Hiệu quả kinh tế
EduSync giúp giảm chi phí và tối ưu hóa công tác quản lý thi đua – phong trào trong trường THPT.

Trước đây, việc tổng hợp và chấm điểm thủ công bằng giấy tờ, Excel tốn nhiều thời gian và nhân lực;

nay được số hóa hoàn toàn, tiết kiệm đáng kể chi phí nhân sự và vật liệu.

Vercel và Supabase có gói miễn phí lớn, chi phí duy trì gần như bằng không.

Hệ thống giúp Ban Chấp hành và Ban Thi đua tập trung vào tổ chức và đánh giá phong trào thay vì nhập liệu, nhờ các tính năng tự động tính điểm, xếp hạng và báo cáo, giảm sai sót và thời gian chỉnh sửa.

Nhìn chung, EduSync giảm chi phí, tăng hiệu quả và tối ưu phân bổ nguồn lực cho các hoạt động giáo dục khác.

##### 3.2. Hiệu quả xã hội
EduSync góp phần xây dựng môi trường học đường minh bạch, công bằng và khuyến khích hành vi tích cực của học sinh.

Việc công khai điểm thi đua và vi phạm giúp học sinh theo dõi kết quả, hiểu tiêu chí đánh giá và chủ động tham gia phong trào.

Hệ thống còn tăng cường tinh thần tự quản và phối hợp tập thể, khi Ban Chấp hành và Ban Thi đua làm việc trên cùng nền tảng, giảm sai lệch và nâng cao hiệu quả quản lý.

Báo cáo trực quan giúp nhận diện rõ tiến độ, kết quả và hành vi cần khen thưởng hoặc nhắc nhở.Ngoài ra, EduSync có thể mở rộng áp dụng cho nhiều trường THPT, chuẩn hóa quy trình thi đua – phong trào, góp phần xây dựng môi trường giáo dục văn minh và truyền cảm hứng.

### IV. KẾT LUẬN
Qua quá trình nghiên cứu, thiết kế và phát triển, dự án EduSync – Hệ thống Hỗ trợ Quản lý Phong trào và Thi đua dành cho các trường THPT đã chứng minh được tính khả thi, tính ứng dụng và hiệu quả thực tiễn cao.

Hệ thống không chỉ giúp số hóa toàn bộ quy trình quản lý phong trào và thi đua, từ nhập điểm, tính điểm, duyệt kết quả, đến tổng hợp bảng xếp hạng, mà còn đảm bảo minh bạch, công bằng và bảo mật dữ liệu nhờ ứng dụng các công nghệ hiện đại như Next.js, Supabase, Edge Functions và RBAC linh động.

EduSync góp phần nâng cao hiệu quả quản lý, tiết kiệm chi phí và nhân lực cho Ban Chấp hành và Ban Thi đua, đồng thời tạo môi trường học đường năng động, minh bạch và khuyến khích hành vi tích cực của học sinh.

Khả năng mở rộng vai trò, module và tích hợp các công nghệ mới trong tương lai cũng giúp hệ thống thích ứng linh hoạt với nhu cầu phát triển của nhà trường.

Từ kết quả nghiên cứu và báo cáo nêu trên, có thể khẳng định rằng EduSync không chỉ là một công cụ quản lý hiệu quả, mà còn là một nền tảng có giá trị thực tiễn cao, hướng tới việc chuẩn hóa quản lý phong trào và thi đua trong các trường THPT Việt Nam, góp phần xây dựng môi trường giáo dục công bằng, sáng tạo và truyền cảm hứng cho học sinh.

## Phụ lục 1. Tổng quan về công nghệ sử dụng
Trong quá trình thiết kế và phát triển hệ thống EduSync – Hệ thống Hỗ trợ Quản lý Phong trào và Thi đua dành cho các trường THPT, nhóm nghiên cứu đã cân nhắc nhiều yếu tố về hiệu năng, khả năng mở rộng, chi phí, bảo mật, cũng như độ phổ biến của công nghệ.

Kết quả là lựa chọn các thành phần công nghệ chính như sau:

**1. Next.js (React + TypeScript)**
* Khả năng kết hợp Server-side Rendering (SSR) và Client-side Rendering (CSR), giúp tối ưu tốc độ tải trang và thân thiện với người dùng.
* Hỗ trợ tái sử dụng components và mở rộng linh hoạt, dễ tích hợp với PWA và các thư viện UI hiện đại như shadcn/ui và TailwindCSS.
* Tối ưu SEO và khả năng indexing (dù EduSync chủ yếu dùng nội bộ, vẫn hữu ích nếu mở rộng ra web công cộng).

**2. Supabase (PostgreSQL + Edge Functions + Auth + Realtime)**
* Cung cấp backend-as-a-service với cơ sở dữ liệu quan hệ mạnh mẽ và tính năng realtime, phù hợp với yêu cầu quản lý dữ liệu phong trào/thi đua theo thời gian thực.
* Edge Functions cho phép xử lý nghiệp vụ phức tạp gần cơ sở dữ liệu, giảm tải cho frontend và tăng tính bảo mật.
* Auth tích hợp sẵn giúp triển khai RBAC nhanh, đảm bảo phân quyền linh hoạt, tách biệt rõ ràng giữa các vai trò (CEC, SEC, Admin, Student).

**3. Vercel**
* Là nền tảng triển khai tối ưu cho Next.js, hỗ trợ CI/CD tự động, build nhanh, deploy trực tiếp từ GitHub.

**4. PWA (Progressive Web App)**
* Giúp ứng dụng cài đặt như native app trên máy tính và điện thoại, hoạt động offline cơ bản nhờ caching, đảm bảo trải nghiệm mượt mà ngay cả khi mạng không ổn định.

**5. Công cụ hỗ trợ frontend khác**
* **Tailwind CSS + shadcn/ui:** giúp xây dựng giao diện đẹp, nhất quán, dễ bảo trì.
* **Framer Motion:** tăng trải nghiệm người dùng với các hiệu ứng chuyển động mượt mà, trực quan.

**6. Lý do tổng thể**
* Bộ công nghệ này đáp ứng tất cả yêu cầu về hiệu năng, bảo mật, khả năng mở rộng, và trải nghiệm người dùng.
* Giúp tối ưu thời gian phát triển, giảm chi phí và rủi ro, đồng thời đảm bảo EduSync có thể duy trì và mở rộng tính năng trong tương lai.

## Phụ lục 2. Bảng giải thích các thuật ngữ sử dụng
| Thuật ngữ | Giải thích |
| :--- | :--- |
| Auth (Authentication) | "Hệ thống đăng nhập, bảo đảm mỗi người dùng dùng tài khoản riêng" |
| Backend | "“Bộ não” xử lý dữ liệu, tính điểm, lưu trữ thông tin" |
| Client-side Rendering (CSR) | "Trang web tải dữ liệu trực tiếp trên máy của người dùng, giúp tương tác mượt mà" |
| Dashboard | "Bảng tổng quan, hiển thị tất cả phong trào, thi đua, điểm số và thống kê" |
| Edge Functions | "Các chương trình nhỏ chạy phía server để xử lý tính điểm, duyệt phong trào, thống kê…" |
| Frontend | Giao diện người dùng nhìn thấy và tương tác trực tiếp |
| Framer Motion | Thư viện tạo hiệu ứng chuyển động mượt mà trên trang web |
| JWT (JSON Web Token) | "“Chứng minh thư” điện tử của người dùng, bảo vệ thông tin khi đăng nhập" |
| Module | "Một thành phần chức năng riêng biệt của hệ thống, ví dụ: nhập điểm, duyệt phong trào, tổng hợp kết quả" |
| Next.js | "Công cụ lập trình web hiện đại, giúp ứng dụng chạy nhanh và hiển thị đúng trên cả máy tính lẫn điện thoại" |
| Offline Caching | Lưu tạm dữ liệu để dùng khi mất mạng |
| PWA (Progressive Web App) | "Ứng dụng web mà bạn có thể cài như app điện thoại, vẫn dùng được khi mất mạng" |
| PostgreSQL | "Nơi lưu dữ liệu, ví dụ như danh sách học sinh, điểm thi đua, phong trào" |
| Prefetching | Tải trước dữ liệu để khi mở trang nhanh hơn |
| RBAC (Role-Based Access Control) | Hệ thống phân quyền: mỗi người chỉ làm được việc mà vai trò của họ được phép |
| React | "Thư viện lập trình để tạo giao diện người dùng (như các nút bấm, bảng thống kê)" |
| RLS (Row-Level Security) | Mỗi người chỉ nhìn và sửa dữ liệu mà họ có quyền |
| SSR (Server-side Rendering) | "Trang web được chuẩn bị sẵn trên máy chủ, mở nhanh hơn" |
| Soft Delete | "Xóa tạm thời, dữ liệu vẫn có thể phục hồi nếu cần" |
| Supabase | "Nền tảng lưu trữ dữ liệu và quản lý người dùng, giống như “bộ não” của hệ thống" |
| Tailwind CSS | "Công cụ thiết kế giao diện nhanh, giúp bố cục và màu sắc đẹp mắt" |
| TypeScript | "Phiên bản nâng cấp của JavaScript, giúp tránh lỗi khi lập trình" |
| Workflow | Quy trình thao tác trong hệ thống: nhập điểm → duyệt → thống kê → báo cáo |
| Vercel | "Nền tảng triển khai ứng dụng, build và cập nhật phiên bản nhanh" |