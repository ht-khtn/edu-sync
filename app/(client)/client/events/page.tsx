import { ClientMainContent } from "@/components/client/ClientMainContent";
import { SectionContainer } from "@/components/ui-extended/SectionContainer";
import { EventCard } from "@/components/client/content/EventCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const dynamic = "force-dynamic";

const mockEvents = [
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
    title: "Giải bóng đá liên lớp",
    description: "Giải bóng đá giao lưu giữa các lớp khối 11",
    date: "2025-11-20",
    time: "15:00 - 17:00",
    location: "Sân vận động trường",
    participants: 200,
    status: "ongoing" as const,
  },
  {
    id: "3",
    title: "Ngày hội văn hóa",
    description: "Ngày hội giới thiệu văn hóa các dân tộc Việt Nam",
    date: "2025-11-28",
    time: "08:00 - 12:00",
    location: "Khuôn viên trường",
    participants: 500,
    status: "upcoming" as const,
  },
  {
    id: "4",
    title: "Workshop kỹ năng mềm",
    description: "Đào tạo kỹ năng giao tiếp và làm việc nhóm",
    date: "2025-11-10",
    time: "13:00 - 16:00",
    location: "Phòng 301",
    participants: 80,
    status: "completed" as const,
  },
  {
    id: "5",
    title: "Chuyến tham quan bảo tàng",
    description: "Tham quan Bảo tàng Lịch sử Việt Nam",
    date: "2025-11-30",
    time: "07:00 - 16:00",
    location: "Bảo tàng Lịch sử",
    participants: 120,
    status: "upcoming" as const,
  },
];

export default function EventsPage() {
  const upcomingEvents = mockEvents.filter((e) => e.status === "upcoming");
  const ongoingEvents = mockEvents.filter((e) => e.status === "ongoing");
  const completedEvents = mockEvents.filter((e) => e.status === "completed");

  return (
    <ClientMainContent>
      <SectionContainer
        title="Sự kiện"
        description="Các hoạt động và sự kiện của trường"
      >
        <Tabs defaultValue="upcoming" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="upcoming">Sắp diễn ra</TabsTrigger>
            <TabsTrigger value="ongoing">Đang diễn ra</TabsTrigger>
            <TabsTrigger value="completed">Đã kết thúc</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="mt-6">
            <div
              className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
              suppressHydrationWarning
            >
              {upcomingEvents.map((event) => (
                <EventCard key={event.id} {...event} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="ongoing" className="mt-6">
            <div
              className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
              suppressHydrationWarning
            >
              {ongoingEvents.map((event) => (
                <EventCard key={event.id} {...event} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="completed" className="mt-6">
            <div
              className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
              suppressHydrationWarning
            >
              {completedEvents.map((event) => (
                <EventCard key={event.id} {...event} />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </SectionContainer>
    </ClientMainContent>
  );
}
