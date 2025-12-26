import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { JoinSessionForm } from '@/components/olympia/client/client/JoinSessionForm'
import { Users, Eye, Gamepad2, HelpCircle } from 'lucide-react'

export const metadata = {
    title: 'Tham gia phòng thi | Olympia',
    description: 'Tham gia phòng thi Olympia với tư cách thí sinh, khách, hoặc MC',
}

export default function JoinPage() {
    return (
        <section className="space-y-8">
            {/* Header */}
            <div className="text-center space-y-2 py-4">
                <h1 className="text-4xl font-bold tracking-tight">🎯 Tham gia phòng thi</h1>
                <p className="text-xl text-muted-foreground">Tham gia trận thi Olympia của bạn ngay bây giờ</p>
            </div>

            {/* Quick Join Form */}
            <Card className="border-2 border-blue-200 bg-blue-50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Gamepad2 className="h-5 w-5" />
                        Tham gia nhanh
                    </CardTitle>
                    <CardDescription>Nhập mã tham gia để vào phòng thi</CardDescription>
                </CardHeader>
                <CardContent>
                    <JoinSessionForm />
                </CardContent>
            </Card>

            {/* Info Alert */}
            <Alert>
                <HelpCircle className="h-4 w-4" />
                <AlertTitle>Bạn không biết mã tham gia?</AlertTitle>
                <AlertDescription>
                    Bạn có thể xem danh sách các trận sắp tới và tham gia từ đó. Hoặc hãy kiểm tra email hoặc tin nhắn từ giáo viên.
                </AlertDescription>
            </Alert>

            {/* Join Methods */}
            <div className="space-y-4">
                <h2 className="text-2xl font-bold">Các cách tham gia</h2>

                <div className="grid gap-4 md:grid-cols-3">
                    {/* Player Mode */}
                    <Card>
                        <CardHeader>
                            <Badge className="w-fit">Thí sinh</Badge>
                            <CardTitle className="text-lg flex items-center gap-2 mt-2">
                                <Users className="h-5 w-5" />
                                Chế độ chơi
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm text-muted-foreground">Tham gia với tư cách thí sinh, hoàn thành các bài thi và cạnh tranh xếp hạng.</p>
                            <ul className="space-y-2 text-sm">
                                <li className="flex items-start gap-2">
                                    <span className="text-blue-600 font-bold">✓</span>
                                    <span>Trả lời câu hỏi trắc nghiệm</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-blue-600 font-bold">✓</span>
                                    <span>Theo dõi điểm số thực tế</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-blue-600 font-bold">✓</span>
                                    <span>Xem bảng xếp hạng</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-blue-600 font-bold">✓</span>
                                    <span>Hỗ trợ đa thiết bị</span>
                                </li>
                            </ul>
                            <div className="text-sm font-medium text-muted-foreground">Cần: Mã tham gia + Mật khẩu</div>
                            <Button asChild className="w-full">
                                <Link href="/olympia/client/matches">Xem danh sách trận</Link>
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Guest Mode */}
                    <Card>
                        <CardHeader>
                            <Badge variant="outline" className="w-fit">Khách</Badge>
                            <CardTitle className="text-lg flex items-center gap-2 mt-2">
                                <Eye className="h-5 w-5" />
                                Chế độ khách
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm text-muted-foreground">Xem bảng xếp hạng trực tiếp mà không cần đăng nhập hay mật khẩu.</p>
                            <ul className="space-y-2 text-sm">
                                <li className="flex items-start gap-2">
                                    <span className="text-green-600 font-bold">✓</span>
                                    <span>Xem bảng xếp hạng trực tiếp</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-green-600 font-bold">✓</span>
                                    <span>Theo dõi tiến độ trận thi</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-green-600 font-bold">✓</span>
                                    <span>Không cần đăng nhập</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-green-600 font-bold">✓</span>
                                    <span>Chia sẻ link công khai</span>
                                </li>
                            </ul>
                            <div className="text-sm font-medium text-muted-foreground">Cần: Mã trận thi</div>
                            <Button asChild variant="outline" className="w-full">
                                <Link href="/olympia/client/matches">Xem danh sách trận</Link>
                            </Button>
                        </CardContent>
                    </Card>

                    {/* MC Mode */}
                    <Card>
                        <CardHeader>
                            <Badge variant="secondary" className="w-fit">MC</Badge>
                            <CardTitle className="text-lg flex items-center gap-2 mt-2">
                                🎙️ Chế độ MC
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm text-muted-foreground">Điều khiển trận thi, quản lý phòng và giám sát thí sinh.</p>
                            <ul className="space-y-2 text-sm">
                                <li className="flex items-start gap-2">
                                    <span className="text-purple-600 font-bold">✓</span>
                                    <span>Quản lý phòng thi</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-purple-600 font-bold">✓</span>
                                    <span>Giám sát thí sinh</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-purple-600 font-bold">✓</span>
                                    <span>Kiểm soát thời gian</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-purple-600 font-bold">✓</span>
                                    <span>Xem thống kê chi tiết</span>
                                </li>
                            </ul>
                            <div className="text-sm font-medium text-muted-foreground">Cần: Mã trận + Mật khẩu MC</div>
                            <Button asChild variant="outline" className="w-full">
                                <Link href="/olympia/client/matches">Xem danh sách trận</Link>
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Steps */}
            <Card>
                <CardHeader>
                    <CardTitle>Bước tham gia từng chế độ</CardTitle>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="player" className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="player">Thí sinh</TabsTrigger>
                            <TabsTrigger value="guest">Khách</TabsTrigger>
                            <TabsTrigger value="mc">MC</TabsTrigger>
                        </TabsList>

                        <TabsContent value="player" className="space-y-4">
                            <ol className="space-y-3">
                                <li className="flex gap-3">
                                    <span className="font-bold text-blue-600 min-w-fit">Bước 1:</span>
                                    <span>Lấy mã tham gia từ giáo viên hoặc từ email</span>
                                </li>
                                <li className="flex gap-3">
                                    <span className="font-bold text-blue-600 min-w-fit">Bước 2:</span>
                                    <span>Nhập mã tham gia vào ô &quot;Mã tham gia&quot; ở trên</span>
                                </li>
                                <li className="flex gap-3">
                                    <span className="font-bold text-blue-600 min-w-fit">Bước 3:</span>
                                    <span>Nhập mật khẩu của bạn để xác thực</span>
                                </li>
                                <li className="flex gap-3">
                                    <span className="font-bold text-blue-600 min-w-fit">Bước 4:</span>
                                    <span>Bạn sẵn sàng! Bắt đầu trả lời các câu hỏi</span>
                                </li>
                            </ol>
                        </TabsContent>

                        <TabsContent value="guest" className="space-y-4">
                            <ol className="space-y-3">
                                <li className="flex gap-3">
                                    <span className="font-bold text-green-600 min-w-fit">Bước 1:</span>
                                    <span>Đi đến trang danh sách trận thi</span>
                                </li>
                                <li className="flex gap-3">
                                    <span className="font-bold text-green-600 min-w-fit">Bước 2:</span>
                                    <span>Tìm trận thi bạn muốn theo dõi</span>
                                </li>
                                <li className="flex gap-3">
                                    <span className="font-bold text-green-600 min-w-fit">Bước 3:</span>
                                    <span>Nhấp vào &quot;Xem chi tiết&quot; → &quot;Xem chế độ khách&quot;</span>
                                </li>
                                <li className="flex gap-3">
                                    <span className="font-bold text-green-600 min-w-fit">Bước 4:</span>
                                    <span>Xem bảng xếp hạng trực tiếp</span>
                                </li>
                            </ol>
                        </TabsContent>

                        <TabsContent value="mc" className="space-y-4">
                            <ol className="space-y-3">
                                <li className="flex gap-3">
                                    <span className="font-bold text-purple-600 min-w-fit">Bước 1:</span>
                                    <span>Tìm trận thi cần quản lý trong danh sách</span>
                                </li>
                                <li className="flex gap-3">
                                    <span className="font-bold text-purple-600 min-w-fit">Bước 2:</span>
                                    <span>Nhấp &quot;Xem chi tiết&quot; → nhập mật khẩu MC</span>
                                </li>
                                <li className="flex gap-3">
                                    <span className="font-bold text-purple-600 min-w-fit">Bước 3:</span>
                                    <span>Truy cập giao diện quản lý phòng thi</span>
                                </li>
                                <li className="flex gap-3">
                                    <span className="font-bold text-purple-600 min-w-fit">Bước 4:</span>
                                    <span>Điều khiển trận thi từ bảng điều khiển</span>
                                </li>
                            </ol>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </section>
    )
}
