import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetClose } from '@/components/ui/sheet'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ArrowRight, BookOpen, PenLine, ListChecks, BarChart3, Menu } from 'lucide-react'

export default function HomePage() {
  return (
    <>
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle>EduSync</CardTitle>
          <CardDescription>Đồng bộ mọi nhịp đập học đường</CardDescription>
          {/* Actions: normal + mobile sheet */}
          <CardContent>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" aria-label="Mở menu">
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent side="right">
                <SheetHeader>
                  <SheetTitle>Menu</SheetTitle>
                  <SheetDescription>Đi tới</SheetDescription>
                </SheetHeader>
                <Button asChild>
                  <Link href="/login">Đăng nhập</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/leaderboard">Bảng xếp hạng</Link>
                </Button>
                <SheetClose asChild>
                  <Button variant="ghost">Đóng</Button>
                </SheetClose>
              </SheetContent>
            </Sheet>

            <Button asChild>
              <Link href="/login">Đăng nhập</Link>
            </Button>

            <Button asChild variant="outline">
              <Link href="/leaderboard">Bảng xếp hạng</Link>
            </Button>
          </CardContent>
        </CardHeader>
      </Card>

      <Separator />

      {/* Hero - centered card */}
      <Card>
        <CardHeader>
          <Avatar>
            <AvatarFallback>ES</AvatarFallback>
          </Avatar>
          <CardTitle>EduSync</CardTitle>
          <CardDescription>Hệ thống hỗ trợ quản lý phong trào và thi đua dành cho học sinh THPT.</CardDescription>
          <CardDescription>Ghi nhận trực tiếp, không cần duyệt. Quyền ghi nhận giới hạn theo vai trò.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/login">Đăng nhập ngay <ArrowRight /></Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="#guide">Xem hướng dẫn <BookOpen /></Link>
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Quick Guide - three small outline cards */}
      <Card id="guide">
        <CardHeader>
          <CardTitle>Hướng dẫn nhanh</CardTitle>
          <CardDescription>Những bước cơ bản để bắt đầu sử dụng</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Item 1 */}
          <Card>
            <CardHeader>
              <CardTitle>
                <PenLine /> Nhập vi phạm
              </CardTitle>
              <CardDescription>Ghi nhận lỗi của lớp trong phạm vi được phân.</CardDescription>
            </CardHeader>
          </Card>

          {/* Item 2 */}
          <Card>
            <CardHeader>
              <CardTitle>
                <ListChecks /> Điểm tiêu chí
              </CardTitle>
              <CardDescription>Tự động trừ điểm theo bảng criteria.</CardDescription>
            </CardHeader>
          </Card>

          {/* Item 3 */}
          <Card>
            <CardHeader>
              <CardTitle>
                <BarChart3 /> Bảng xếp hạng
              </CardTitle>
              <CardDescription>Theo dõi tổng điểm và phong trào.</CardDescription>
            </CardHeader>
          </Card>
        </CardContent>
      </Card>

      <Separator />

      {/* Footer */}
      <Card>
        <CardContent>
          <CardDescription>© 2025 EduSync – Hệ thống hỗ trợ quản lý phong trào và thi đua dành cho học sinh THPT.</CardDescription>
        </CardContent>
        <CardFooter>
          <Button asChild variant="link" size="sm">
            <Link href="#">Chính sách</Link>
          </Button>
          <Button asChild variant="link" size="sm">
            <Link href="#">Liên hệ</Link>
          </Button>
          <Button asChild variant="link" size="sm">
            <Link href="https://github.com">Github</Link>
          </Button>
        </CardFooter>
      </Card>
    </>
  )
}

