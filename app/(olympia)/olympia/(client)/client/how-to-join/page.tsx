import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Zap, Eye, Lock } from 'lucide-react'

export const metadata = {
    title: 'Hướng dẫn tham gia - Olympia Quiz Live',
    description: 'Tìm hiểu các cách khác nhau để tham gia trò chơi Olympia',
}

export default function OlympiaHowToJoinPage() {
    const modes = [
        {
            icon: Zap,
            title: 'Chế độ Thí sinh (Player)',
            color: 'blue',
            badge: 'Tham gia game',
            description: 'Vào phòng thi để trả lời câu hỏi, ghi điểm và cạnh tranh với những thí sinh khác',
            features: ['Trả lời câu hỏi trắc nghiệm', 'Thể hiện điểm số real-time', 'Xem bảng xếp hạng', 'Tham gia các vòng thi'],
            how: [
                'Nhập mã phòng thi do host cung cấp',
                'Nhập mật khẩu để xác thực danh tính',
                'Bắt đầu trả lời các câu hỏi khi host mở',
            ],
            action: {
                href: '/olympia/client/join',
                label: 'Tham gia nhanh →',
            },
        },
        {
            icon: Eye,
            title: 'Chế độ Khách (Guest)',
            color: 'green',
            badge: 'Xem công khai',
            description: 'Xem livestream trận thi, bảng điểm công khai mà không cần đăng nhập chi tiết',
            features: ['Xem bảng điểm real-time', 'Theo dõi vòng thi hiện tại', 'Xem danh sách thí sinh', 'Không cần xác thực'],
            how: [
                'Chọn trận thi từ danh sách',
                'Nhấp vào nút "Xem chế độ khách"',
                'Theo dõi trận thi trực tiếp',
            ],
            action: {
                href: '/olympia/client/matches',
                label: 'Chọn trận thi →',
            },
        },
        {
            icon: Lock,
            title: 'Chế độ MC (Master of Ceremony)',
            color: 'amber',
            badge: 'Quản lý',
            description: 'Được cấp quyền quản lý trận, xem đầy đủ thông tin và kiểm soát dòng chảy trò chơi',
            features: ['Xem trạng thái câu hỏi chi tiết', 'Theo dõi điểm số từng thí sinh', 'Xem log realtime', 'Quản lý phòng thi'],
            how: [
                'Chọn trận thi từ danh sách',
                'Nhấp vào nút "Xem chi tiết"',
                'Chọn chế độ MC và nhập mật khẩu',
                'Truy cập dashboard quản lý',
            ],
            action: {
                href: '/olympia/client/matches',
                label: 'Trận của tôi →',
            },
        },
    ]

    return (
        <section className="space-y-8">
            <div className="space-y-2">
                <h1 className="text-4xl font-bold tracking-tight">🎯 Hướng dẫn tham gia</h1>
                <p className="text-lg text-muted-foreground">
                    Tìm hiểu cách tham gia Olympia Quiz Live theo các vai trò khác nhau
                </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-1">
                {modes.map((mode, idx) => {
                    const Icon = mode.icon
                    const colorClasses = {
                        blue: 'border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/50 dark:to-cyan-950/50',
                        green:
                            'border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/50 dark:to-emerald-950/50',
                        amber:
                            'border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/50 dark:to-orange-950/50',
                    }

                    return (
                        <Card key={idx} className={`border-2 ${colorClasses[mode.color as keyof typeof colorClasses]}`}>
                            <CardHeader>
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-center gap-3 flex-1">
                                        <Icon className="h-8 w-8 flex-shrink-0" />
                                        <div>
                                            <CardTitle className="text-2xl flex items-center gap-2">
                                                {mode.title}
                                                <Badge variant="outline" className="text-sm">
                                                    {mode.badge}
                                                </Badge>
                                            </CardTitle>
                                            <CardDescription className="mt-1">{mode.description}</CardDescription>
                                        </div>
                                    </div>
                                </div>
                            </CardHeader>

                            <CardContent className="space-y-6">
                                {/* Features */}
                                <div>
                                    <h4 className="font-semibold text-sm uppercase text-muted-foreground mb-3">Tính năng</h4>
                                    <ul className="grid md:grid-cols-2 gap-2">
                                        {mode.features.map((feature, i) => (
                                            <li key={i} className="flex items-center gap-2 text-sm">
                                                <span className="text-lg">✓</span>
                                                {feature}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {/* How to */}
                                <div>
                                    <h4 className="font-semibold text-sm uppercase text-muted-foreground mb-3">Cách thực hiện</h4>
                                    <ol className="space-y-2">
                                        {mode.how.map((step, i) => (
                                            <li key={i} className="flex gap-3 text-sm">
                                                <span className="font-semibold text-lg flex-shrink-0 w-6 h-6 rounded-full bg-white/50 flex items-center justify-center">
                                                    {i + 1}
                                                </span>
                                                <span>{step}</span>
                                            </li>
                                        ))}
                                    </ol>
                                </div>

                                {/* Action Button */}
                                <Button asChild className="w-full gap-2">
                                    <Link href={mode.action.href}>{mode.action.label}</Link>
                                </Button>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>

            {/* FAQ-like section */}
            <Card className="border-dashed">
                <CardHeader>
                    <CardTitle className="text-lg">❓ Câu hỏi thường gặp</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <h4 className="font-semibold mb-1">Tôi làm thế nào để tìm mã phòng thi?</h4>
                        <p className="text-sm text-muted-foreground">
                            Ban tổ chức sẽ cung cấp mã phòng thi qua email hoặc thông báo. Bạn có thể nhập nó trực tiếp tại{' '}
                            <Link href="/olympia/client/join" className="text-blue-600 hover:underline">
                                trang tham gia
                            </Link>
                        </p>
                    </div>

                    <div>
                        <h4 className="font-semibold mb-1">Tôi có thể xem trận thi mà không tham gia không?</h4>
                        <p className="text-sm text-muted-foreground">
                            Có! Chế độ khách cho phép bạn xem bảng điểm công khai và theo dõi trận thi trực tiếp mà không cần mật khẩu.
                        </p>
                    </div>

                    <div>
                        <h4 className="font-semibold mb-1">Mật khẩu phòng thi là gì?</h4>
                        <p className="text-sm text-muted-foreground">
                            Mật khẩu do host cung cấp để xác thực danh tính thí sinh. Nó khác với mã phòng thi.
                        </p>
                    </div>

                    <div>
                        <h4 className="font-semibold mb-1">Tôi có thể chuyển giữa các chế độ không?</h4>
                        <p className="text-sm text-muted-foreground">
                            Nếu bạn là thí sinh, hãy sử dụng chế độ Player để trả lời câu hỏi. Nếu bạn là khán giả, hãy sử dụng chế độ Guest.
                            Chế độ MC dành riêng cho những người quản lý trận.
                        </p>
                    </div>
                </CardContent>
            </Card>

            <Button asChild variant="outline" className="w-full">
                <Link href="/olympia/client">← Quay lại trang chủ</Link>
            </Button>
        </section>
    )
}
