import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { JoinSessionForm } from '@/components/olympia/client/client/JoinSessionForm'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft, Zap } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default function OlympiaQuickJoinPage() {
    return (
        <section className="min-h-screen flex items-center justify-center py-8">
            <div className="w-full max-w-md space-y-6">
                {/* Header */}
                <div className="text-center space-y-2">
                    <div className="flex items-center justify-center gap-2 text-3xl font-bold">
                        <Zap className="h-8 w-8 text-blue-600" />
                        Tham gia nhanh
                    </div>
                    <p className="text-muted-foreground">Nhập mã phòng thi để bắt đầu</p>
                </div>

                {/* Join Form */}
                <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/50 dark:to-cyan-950/50">
                    <CardHeader>
                        <CardTitle className="text-lg">Mã phòng thi</CardTitle>
                        <CardDescription>Do ban tổ chức cung cấp</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <JoinSessionForm />
                    </CardContent>
                </Card>

                {/* Info Cards */}
                <div className="space-y-3 text-sm">
                    <Card className="border-dashed">
                        <CardContent className="pt-6">
                            <div className="space-y-2">
                                <h3 className="font-semibold flex items-center gap-2">
                                    📝 Bước thực hiện
                                </h3>
                                <ol className="space-y-1 list-decimal list-inside text-muted-foreground">
                                    <li>Nhập mã phòng thi (ví dụ: ABC123)</li>
                                    <li>Nhập mật khẩu do host cung cấp</li>
                                    <li>Nhấn tham gia để vào phòng</li>
                                </ol>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-dashed">
                        <CardContent className="pt-6">
                            <div className="space-y-2">
                                <h3 className="font-semibold flex items-center gap-2">
                                    ❓ Chưa có mã?
                                </h3>
                                <p className="text-muted-foreground mb-3">
                                    Xem danh sách trận thi sắp tới hoặc đang diễn ra
                                </p>
                                <Button asChild variant="outline" className="w-full">
                                    <Link href="/olympia/client/matches">
                                        Xem lịch thi →
                                    </Link>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Back Button */}
                <Button asChild variant="outline" className="w-full gap-2">
                    <Link href="/olympia/client">
                        <ArrowLeft className="h-4 w-4" />
                        Quay lại trang chủ
                    </Link>
                </Button>
            </div>
        </section>
    )
}
