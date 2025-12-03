import { ClientMainContent } from "@/components/layout/client/ClientMainContent";
import { SectionContainer } from "@/components/ui-extended/SectionContainer";
import { AnnouncementCard } from "@/components/domain/client/content/AnnouncementCard";
import { CategoryTabs } from "@/components/domain/client/content/CategoryTabs";
import { Button } from "@/components/ui/button";
import { Filter } from "lucide-react";

const mockAnnouncements = [
  {
    id: "1",
    title: "Thông báo thi đua học kỳ I",
    content:
      "Các lớp cần nộp kết quả thi đua trước ngày 30/11/2025. Vui lòng liên hệ với ban cán sự để biết thêm chi tiết.",
    date: "2025-11-15",
    type: "info" as const,
    category: "Học tập",
  },
  {
    id: "2",
    title: "Kế hoạch kiểm tra giữa kỳ",
    content:
      "Kiểm tra giữa kỳ sẽ được tổ chức từ ngày 20-25/11. Học sinh cần chuẩn bị đầy đủ tài liệu và dụng cụ học tập.",
    date: "2025-11-12",
    type: "warning" as const,
    category: "Thi cử",
  },
  {
    id: "3",
    title: "Chương trình tình nguyện cuối tuần",
    content:
      "Đăng ký tham gia hoạt động tình nguyện cuối tuần tại phòng Công tác học sinh. Thời hạn đăng ký: 18/11/2025.",
    date: "2025-11-10",
    type: "success" as const,
    category: "Hoạt động",
  },
  {
    id: "4",
    title: "Lưu ý về quy định trang phục",
    content:
      "Học sinh cần tuân thủ quy định về trang phục từ thứ Hai đến thứ Sáu. Vi phạm sẽ bị xử lý theo nội quy.",
    date: "2025-11-08",
    type: "warning" as const,
    category: "Nội quy",
  },
  {
    id: "5",
    title: "Họp phụ huynh học kỳ I",
    content:
      "Thông báo tổ chức họp phụ huynh vào ngày 25/11/2025. Kính mong phụ huynh sắp xếp thời gian tham dự.",
    date: "2025-11-05",
    type: "urgent" as const,
    category: "Phụ huynh",
  },
  {
    id: "6",
    title: "Cuộc thi Olympic các môn học",
    content:
      "Trường tổ chức cuộc thi Olympic cấp trường cho các môn Toán, Lý, Hóa, Văn. Đăng ký tại văn phòng trước ngày 22/11.",
    date: "2025-11-03",
    type: "success" as const,
    category: "Thi đấu",
  },
];

export default function AnnouncementsPage() {
  const allAnnouncements = mockAnnouncements;
  const urgentAnnouncements = mockAnnouncements.filter(
    (a) => a.type === "urgent" || a.type === "warning"
  );
  const eventAnnouncements = mockAnnouncements.filter(
    (a) => a.type === "success"
  );

  return (
    <ClientMainContent>
      <SectionContainer
        title="Thông báo"
        description="Tất cả thông báo và tin tức từ nhà trường"
        action={
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            Bộ lọc
          </Button>
        }
      >
        <CategoryTabs
          tabs={[
            {
              value: "all",
              label: "Tất cả",
              content: (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {allAnnouncements.map((announcement) => (
                    <AnnouncementCard key={announcement.id} {...announcement} />
                  ))}
                </div>
              ),
            },
            {
              value: "important",
              label: "Quan trọng",
              content: (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {urgentAnnouncements.map((announcement) => (
                    <AnnouncementCard key={announcement.id} {...announcement} />
                  ))}
                </div>
              ),
            },
            {
              value: "events",
              label: "Sự kiện",
              content: (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {eventAnnouncements.map((announcement) => (
                    <AnnouncementCard key={announcement.id} {...announcement} />
                  ))}
                </div>
              ),
            },
          ]}
        />
      </SectionContainer>
    </ClientMainContent>
  );
}
