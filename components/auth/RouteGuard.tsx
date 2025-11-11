"use client"

import Link from 'next/link'
import { ReactNode } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

type Props = {
  children: ReactNode
  requireAuth?: boolean
}

export default function RouteGuard({ children, requireAuth = true }: Props) {
  const auth = useAuth()

  if (auth.loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Đang tải...</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-9 w-1/2" />
        </CardContent>
      </Card>
    )
  }

  if (requireAuth && !auth.userId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cần đăng nhập</CardTitle>
        </CardHeader>
        <CardContent>
          Bạn cần đăng nhập để truy cập trang này.
        </CardContent>
        <CardFooter>
          <Button asChild>
            <Link href="/login">Đăng nhập</Link>
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return <>{children}</>
}
