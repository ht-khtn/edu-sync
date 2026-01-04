'use client'

import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { UserMenu } from '@/components/client/UserMenu'
import { useSession } from '@/hooks/useSession'

type Props = {
    loginRedirectTo: string
}

export function OlympiaAccountMenu({ loginRedirectTo }: Props) {
    const { data } = useSession()

    if (data?.user?.id) {
        return <UserMenu user={{ id: data.user.id }} hasAdminAccess={data.hasOlympiaAccess} />
    }

    return (
        <Button asChild size="sm">
            <Link href={`/login?redirect=${encodeURIComponent(loginRedirectTo)}`}>Đăng nhập</Link>
        </Button>
    )
}
