import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Eye, Gamepad2, Lock, Zap, HelpCircle, CheckCircle2, Trophy } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export const metadata = {
    title: 'Hướng dẫn tham gia | Olympia',
    description: 'Hướng dẫn chi tiết cách tham gia phòng thi Olympia',
}

export default function HowToJoinPage() {
    return (
        <section className="space-y-8">
            {/* Header */}
            <div className="text-center space-y-2 py-6">
                <h1 className="text-4xl font-bold tracking-tight">❓ Hướng dẫn tham gia Olympia</h1>
                <p className="text-xl text-muted-foreground">Tìm hiểu các cách khác nhau để tham gia phòng thi của bạn</p>
            </div>

            {/* Three Main Modes */}
            <div className="space-y-4">
                <h2 className="text-2xl font-bold">Các chế độ tham gia</h2>
                <div className="grid gap-6 lg:grid-cols-3">
                    {/* Player Mode */}
                    <Card className="border-2 border-blue-300 overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-400 to-blue-600 h-2" />
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <Badge className="bg-blue-600">Thí sinh</Badge>
                                <Gamepad2 className="h-6 w-6 text-blue-600" />
                            </div>
                            <CardTitle className="text-xl mt-2">Chế độ chơi</CardTitle>
                            <CardDescription>Tham gia với tư cách thí sinh</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm font-medium">Mô tả:</p>
                            <p className="text-sm text-muted-foreground">Tham gia trận thi trắc nghiệm trực tiếp, trả lời câu hỏi, và cạnh tranh xếp hạng với những người chơi khác.</p>

                            <div className="space-y-2">
                                <p className="text-sm font-medium">Tính năng chính:</p>
                                <ul className="space-y-2">
                                    <li className="flex items-start gap-2 text-sm">
                                        <CheckCircle2 className="h-4 w-4 text-blue-600 min-w-fit mt-0.5" />
                                        <span>Trả lời câu hỏi trắc nghiệm</span>
                                    </li>
                                    <li className="flex items-start gap-2 text-sm">
                                        <CheckCircle2 className="h-4 w-4 text-blue-600 min-w-fit mt-0.5" />
                                        <span>Theo dõi điểm số real-time</span>
                                    </li>
                                    <li className="flex items-start gap-2 text-sm">
                                        <CheckCircle2 className="h-4 w-4 text-blue-600 min-w-fit mt-0.5" />
                                        <span>Xem bảng xếp hạng</span>
                                    </li>
                                    <li className="flex items-start gap-2 text-sm">
                                        <CheckCircle2 className="h-4 w-4 text-blue-600 min-w-fit mt-0.5" />
                                        <span>Hỗ trợ đa thiết bị</span>
                                    </li>
                                </ul>
                            </div>

                            <div className="bg-blue-50 p-3 rounded-lg">
                                <p className="text-xs font-medium text-blue-900">Yêu cầu:</p>
                                <p className="text-sm text-blue-800">Mã tham gia + Mật khẩu cá nhân</p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Guest Mode */}
                    <Card className="border-2 border-green-300 overflow-hidden">
                        <div className="bg-gradient-to-r from-green-400 to-green-600 h-2" />
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <Badge variant="outline" className="border-green-600 text-green-600">Khách</Badge>
                                <Eye className="h-6 w-6 text-green-600" />
                            </div>
                            <CardTitle className="text-xl mt-2">Chế độ khách</CardTitle>
                            <CardDescription>Xem bảng xếp hạng mà không tham gia</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm font-medium">Mô tả:</p>
                            <p className="text-sm text-muted-foreground">Xem bảng xếp hạng trực tiếp và theo dõi tiến độ của trận thi mà không cần đăng nhập hoặc mật khẩu.</p>

                            <div className="space-y-2">
                                <p className="text-sm font-medium">Tính năng chính:</p>
                                <ul className="space-y-2">
                                    <li className="flex items-start gap-2 text-sm">
                                        <CheckCircle2 className="h-4 w-4 text-green-600 min-w-fit mt-0.5" />
                                        <span>Xem bảng xếp hạng trực tiếp</span>
                                    </li>
                                    <li className="flex items-start gap-2 text-sm">
                                        <CheckCircle2 className="h-4 w-4 text-green-600 min-w-fit mt-0.5" />
                                        <span>Theo dõi tiến độ trận thi</span>
                                    </li>
                                    <li className="flex items-start gap-2 text-sm">
                                        <CheckCircle2 className="h-4 w-4 text-green-600 min-w-fit mt-0.5" />
                                        <span>Không cần đăng nhập</span>
                                    </li>
                                    <li className="flex items-start gap-2 text-sm">
                                        <CheckCircle2 className="h-4 w-4 text-green-600 min-w-fit mt-0.5" />
                                        <span>Chia sẻ link công khai</span>
                                    </li>
                                </ul>
                            </div>

                            <div className="bg-green-50 p-3 rounded-lg">
                                <p className="text-xs font-medium text-green-900">Yêu cầu:</p>
                                <p className="text-sm text-green-800">Mã trận thi hoặc link trực tiếp</p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* MC Mode */}
                    <Card className="border-2 border-purple-300 overflow-hidden">
                        <div className="bg-gradient-to-r from-purple-400 to-purple-600 h-2" />
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <Badge variant="secondary" className="bg-purple-600">MC</Badge>
                                <Lock className="h-6 w-6 text-purple-600" />
                            </div>
                            <CardTitle className="text-xl mt-2">Chế độ MC</CardTitle>
                            <CardDescription>Quản lý và điều khiển phòng thi</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm font-medium">Mô tả:</p>
                            <p className="text-sm text-muted-foreground">Truy cập giao diện quản lý toàn bộ phòng thi, giám sát thí sinh, kiểm soát thời gian và xem thống kê chi tiết.</p>

                            <div className="space-y-2">
                                <p className="text-sm font-medium">Tính năng chính:</p>
                                <ul className="space-y-2">
                                    <li className="flex items-start gap-2 text-sm">
                                        <CheckCircle2 className="h-4 w-4 text-purple-600 min-w-fit mt-0.5" />
                                        <span>Quản lý phòng thi</span>
                                    </li>
                                    <li className="flex items-start gap-2 text-sm">
                                        <CheckCircle2 className="h-4 w-4 text-purple-600 min-w-fit mt-0.5" />
                                        <span>Giám sát thí sinh</span>
                                    </li>
                                    <li className="flex items-start gap-2 text-sm">
                                        <CheckCircle2 className="h-4 w-4 text-purple-600 min-w-fit mt-0.5" />
                                        <span>Kiểm soát thời gian</span>
                                    </li>
                                    <li className="flex items-start gap-2 text-sm">
                                        <CheckCircle2 className="h-4 w-4 text-purple-600 min-w-fit mt-0.5" />
                                        <span>Xem thống kê chi tiết</span>
                                    </li>
                                </ul>
                            </div>

                            <div className="bg-purple-50 p-3 rounded-lg">
                                <p className="text-xs font-medium text-purple-900">Yêu cầu:</p>
                                <p className="text-sm text-purple-800">Mã trận + Mật khẩu MC</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* FAQ Section */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <HelpCircle className="h-5 w-5" />
                        Câu hỏi thường gặp
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <h3 className="font-semibold">Mã tham gia là gì?</h3>
                        <p className="text-sm text-muted-foreground">Mã tham gia là một mã ngắn (thường 6-8 ký tự) được cung cấp bởi giáo viên hoặc được gửi qua email. Nó cho phép bạn tham gia trực tiếp vào phòng thi nhất định.</p>
                    </div>

                    <div className="space-y-2">
                        <h3 className="font-semibold">Tôi có thể thay đổi chế độ tham gia không?</h3>
                        <p className="text-sm text-muted-foreground">Có thể. Bạn có thể tham gia với tư cách thí sinh, sau đó quay lại để xem dưới dạng khách, hoặc ngược lại. Tuy nhiên, mỗi chế độ có yêu cầu xác thực riêng.</p>
                    </div>

                    <div className="space-y-2">
                        <h3 className="font-semibold">Chế độ khách có hoàn toàn miễn phí không?</h3>
                        <p className="text-sm text-muted-foreground">Có, chế độ khách hoàn toàn miễn phí và không cần bất kỳ thông tin xác thực nào. Bạn chỉ cần mã trận thi hoặc link trực tiếp để truy cập.</p>
                    </div>

                    <div className="space-y-2">
                        <h3 className="font-semibold">Điều gì xảy ra nếu mất kết nối Internet?</h3>
                        <p className="text-sm text-muted-foreground">Ứng dụng sẽ cố gắng lưu tiến độ của bạn. Khi kết nối quay lại, dữ liệu sẽ được đồng bộ. Đối với chế độ thí sinh, điểm số sẽ được lưu lại.</p>
                    </div>

                    <div className="space-y-2">
                        <h3 className="font-semibold">Tôi có thể tham gia bằng điện thoại không?</h3>
                        <p className="text-sm text-muted-foreground">Có, Olympia hỗ trợ đầy đủ các thiết bị di động. Giao diện được tối ưu hóa cho cả điện thoại và máy tính để bàn.</p>
                    </div>

                    <div className="space-y-2">
                        <h3 className="font-semibold">Làm cách nào để lấy mật khẩu MC?</h3>
                        <p className="text-sm text-muted-foreground">Mật khẩu MC được cung cấp bởi quản trị viên hệ thống. Liên hệ với giáo viên hoặc quản trị viên để lấy thông tin xác thực MC.</p>
                    </div>
                </CardContent>
            </Card>

            {/* Comparison Table */}
            <Card>
                <CardHeader>
                    <CardTitle>So sánh các chế độ</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b">
                                    <th className="text-left py-3 px-3 font-semibold">Tính năng</th>
                                    <th className="text-center py-3 px-3 font-semibold">Thí sinh</th>
                                    <th className="text-center py-3 px-3 font-semibold">Khách</th>
                                    <th className="text-center py-3 px-3 font-semibold">MC</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="border-b hover:bg-gray-50">
                                    <td className="py-3 px-3">Trả lời câu hỏi</td>
                                    <td className="text-center">✅</td>
                                    <td className="text-center">❌</td>
                                    <td className="text-center">❌</td>
                                </tr>
                                <tr className="border-b hover:bg-gray-50">
                                    <td className="py-3 px-3">Xem bảng xếp hạng</td>
                                    <td className="text-center">✅</td>
                                    <td className="text-center">✅</td>
                                    <td className="text-center">✅</td>
                                </tr>
                                <tr className="border-b hover:bg-gray-50">
                                    <td className="py-3 px-3">Giám sát thí sinh</td>
                                    <td className="text-center">❌</td>
                                    <td className="text-center">❌</td>
                                    <td className="text-center">✅</td>
                                </tr>
                                <tr className="border-b hover:bg-gray-50">
                                    <td className="py-3 px-3">Kiểm soát phòng</td>
                                    <td className="text-center">❌</td>
                                    <td className="text-center">❌</td>
                                    <td className="text-center">✅</td>
                                </tr>
                                <tr className="border-b hover:bg-gray-50">
                                    <td className="py-3 px-3">Yêu cầu xác thực</td>
                                    <td className="text-center">Có</td>
                                    <td className="text-center">Không</td>
                                    <td className="text-center">Có</td>
                                </tr>
                                <tr className="hover:bg-gray-50">
                                    <td className="py-3 px-3">Hỗ trợ đa thiết bị</td>
                                    <td className="text-center">✅</td>
                                    <td className="text-center">✅</td>
                                    <td className="text-center">✅</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Call to Action */}
            <div className="text-center space-y-4 py-6">
                <p className="text-lg font-semibold">Sẵn sàng tham gia?</p>
                <div className="flex gap-3 justify-center flex-wrap">
                    <Button asChild size="lg" className="gap-2">
                        <Link href="/olympia/client/join">
                            <Zap className="h-5 w-5" />
                            Tham gia nhanh
                        </Link>
                    </Button>
                    <Button asChild size="lg" variant="outline" className="gap-2">
                        <Link href="/olympia/client/matches">
                            <Trophy className="h-5 w-5" />
                            Xem danh sách trận
                        </Link>
                    </Button>
                </div>
            </div>
        </section>
    )
}
