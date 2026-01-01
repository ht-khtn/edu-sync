import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { summarizeOlympiaRole } from '@/lib/olympia-access'
import { getServerAuthContext } from '@/lib/server-auth'
import { McJoinForm } from './McJoinForm'

export const dynamic = 'force-dynamic'

export default async function OlympiaMcHomePage() {
    const { appUserId } = await getServerAuthContext()
    if (!appUserId) {
        redirect('/login?redirect=/olympia/mc')
    }

    const role = await summarizeOlympiaRole()
    if (role !== 'olympia-mc' && role !== 'olympia-admin') {
        redirect('/olympia')
    }

    return (
        <section className="mx-auto max-w-2xl px-4 py-8 space-y-6">
            <div className="space-y-2">
                <p className="text-xs uppercase text-muted-foreground">Olympia · MC</p>
                <h1 className="text-3xl font-semibold tracking-tight">Màn hình MC</h1>
                <p className="text-sm text-muted-foreground">Nhập mã phòng để mở màn hình điều hành MC.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Vào trận</CardTitle>
                    <CardDescription>Dùng mã join code của live session</CardDescription>
                </CardHeader>
                <CardContent>
                    <McJoinForm />
                </CardContent>
            </Card>

            <Button asChild variant="outline" size="sm">
                <Link href="/olympia">← Quay lại</Link>
            </Button>
        </section>
    )
}
