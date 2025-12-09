import { ClientMainContent } from "@/components/client/layout/ClientMainContent";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  BookOpen,
  Trophy,
  Settings,
} from "lucide-react";

// User-specific data: Cannot use ISR, must be dynamic per user
export const dynamic = 'force-dynamic';

export default function ProfilePage() {
  // Mock user data
  const user = {
    name: "Nguyễn Văn An",
    email: "nguyenvanan@school.edu.vn",
    phone: "0123456789",
    class: "12A1",
    studentId: "HS2024001",
    dateOfBirth: "15/05/2007",
    address: "123 Đường ABC, Quận 1, TP.HCM",
    averageScore: 8.5,
    rank: 5,
    achievements: 12,
  };

  return (
    <ClientMainContent>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Profile Header */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
              <Avatar className="h-24 w-24">
                <AvatarFallback className="text-2xl bg-[oklch(0.55_0.15_250)] text-white">
                  {user.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 text-center md:text-left space-y-2">
                <div className="flex flex-col md:flex-row md:items-center gap-2">
                  <h1 className="text-2xl font-bold">{user.name}</h1>
                  <Badge variant="secondary">{user.class}</Badge>
                </div>
                <p className="text-muted-foreground">MSSV: {user.studentId}</p>

                <div className="flex flex-wrap gap-4 justify-center md:justify-start pt-2">
                  <div className="flex items-center gap-2 text-sm">
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                    <span>ĐTB: {user.averageScore}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Trophy className="h-4 w-4 text-muted-foreground" />
                    <span>{user.achievements} thành tích</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">
                      Xếp hạng: #{user.rank}
                    </span>
                  </div>
                </div>
              </div>

              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Cài đặt
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Thông tin cá nhân
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2" suppressHydrationWarning>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span>Email</span>
                </div>
                <p className="font-medium">{user.email}</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <span>Số điện thoại</span>
                </div>
                <p className="font-medium">{user.phone}</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Ngày sinh</span>
                </div>
                <p className="font-medium">{user.dateOfBirth}</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>Địa chỉ</span>
                </div>
                <p className="font-medium">{user.address}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Academic Performance */}
        <div className="grid gap-6 md:grid-cols-3" suppressHydrationWarning>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Điểm trung bình</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-[oklch(0.55_0.15_250)]">
                  {user.averageScore}
                </span>
                <span className="text-sm text-muted-foreground">/10</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Học kỳ 1 năm học 2024-2025
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Xếp hạng</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-accent">
                  #{user.rank}
                </span>
                <span className="text-sm text-muted-foreground">/40</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Trong lớp {user.class}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Thành tích</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold">{user.achievements}</span>
                <Trophy className="h-6 w-6 text-yellow-500" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Giải thưởng đạt được
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Thao tác nhanh</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2" suppressHydrationWarning>
              <Button variant="outline" className="justify-start">
                <BookOpen className="h-4 w-4 mr-2" />
                Xem bảng điểm
              </Button>
              <Button variant="outline" className="justify-start">
                <Trophy className="h-4 w-4 mr-2" />
                Danh sách thành tích
              </Button>
              <Button variant="outline" className="justify-start">
                <Calendar className="h-4 w-4 mr-2" />
                Lịch học
              </Button>
              <Button variant="outline" className="justify-start">
                <Settings className="h-4 w-4 mr-2" />
                Cài đặt tài khoản
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </ClientMainContent>
  );
}
