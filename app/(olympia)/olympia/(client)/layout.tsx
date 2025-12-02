import type { ReactNode } from 'react'
import Link from 'next/link'

export default function OlympiaClientLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link href="/client" className="text-base font-semibold">
            EduSync Olympia
          </Link>
          <nav className="flex gap-3 text-sm text-muted-foreground">
            <Link href="/client" className="hover:text-slate-900">
              Trang chủ
            </Link>
            <Link href="/client/matches" className="hover:text-slate-900">
              Lịch thi
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
    </div>
  )
}
