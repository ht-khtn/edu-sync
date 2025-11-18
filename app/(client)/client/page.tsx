import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ClientHero } from "@/components/client/ClientHero";
import { ClientMainContent } from "@/components/client/ClientMainContent";
import { SectionContainer } from "@/components/ui-extended/SectionContainer";
import { AnnouncementCard } from "@/components/client/content/AnnouncementCard";
import { EventCard } from "@/components/client/content/EventCard";
import { ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

const featuredAnnouncements = [
  {
    id: "1",
    title: "Thông báo thi đua học kỳ I",
    content: "Các lớp cần nộp kết quả thi đua trước ngày 30/11/2025.",
    date: "2025-11-15",
    type: "info" as const,
    category: "Học tập",
  },
  {
    id: "2",
    title: "Chương trình tình nguyện",
    content:
      "Đăng ký tham gia hoạt động tình nguyện cuối tuần tại phòng Công tác học sinh.",
    date: "2025-11-10",
    type: "success" as const,
    category: "Hoạt động",
  },
  {
    id: "3",
    title: "Lưu ý về quy định trang phục",
    content:
      "Học sinh cần tuân thủ quy định về trang phục từ thứ Hai đến thứ Sáu.",
    date: "2025-11-08",
    type: "warning" as const,
    category: "Nội quy",
  },
];

const upcomingEvents = [
  {
    id: "1",
    title: "Hội thảo hướng nghiệp",
    description: "Tư vấn và định hướng nghề nghiệp cho học sinh lớp 12",
    date: "2025-11-25",
    time: "14:00 - 16:00",
    location: "Hội trường A",
    participants: 150,
    status: "upcoming" as const,
  },
  {
    id: "2",
    title: "Ngày hội văn hóa",
    description: "Ngày hội giới thiệu văn hóa các dân tộc Việt Nam",
    date: "2025-11-28",
    time: "08:00 - 12:00",
    location: "Khuôn viên trường",
    participants: 500,
    status: "upcoming" as const,
  },
];

export default async function ClientHomePage() {
  return (
    <>
      <ClientHero />

      <ClientMainContent>
        <div className="space-y-12" suppressHydrationWarning>
          {/* Featured Announcements */}
          <SectionContainer
            title="Thông báo nổi bật"
            description="Các thông báo quan trọng từ nhà trường"
            action={
              <Button variant="ghost" asChild>
                <Link href="/client/announcements">
                  Xem tất cả
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            }
          >
            <div
              className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
              suppressHydrationWarning
            >
              {featuredAnnouncements.map((announcement) => (
                <AnnouncementCard key={announcement.id} {...announcement} />
              ))}
            </div>
          </SectionContainer>

          {/* Upcoming Events */}
          <SectionContainer
            title="Sự kiện sắp diễn ra"
            description="Các hoạt động và sự kiện của trường"
            action={
              <Button variant="ghost" asChild>
                <Link href="/client/events">
                  Xem tất cả
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            }
          >
            <div className="grid gap-4 md:grid-cols-2" suppressHydrationWarning>
              {upcomingEvents.map((event) => (
                <EventCard key={event.id} {...event} />
              ))}
            </div>
          </SectionContainer>
        </div>
      </ClientMainContent>
    </>
  );
}
