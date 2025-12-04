import Link from 'next/link'
import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { ensureOlympiaAdminAccess } from '@/lib/olympia-access'

const navItems = [
  { href: '/olympia/admin', label: 'Bảng điều khiển' },
  { href: '/olympia/admin/matches', label: 'Giải & trận' },
  { href: '/olympia/admin/rooms', label: 'Phòng thi' },
  { href: '/olympia/admin/question-bank', label: 'Bộ đề' },
  { href: '/olympia/admin/accounts', label: 'Tài khoản' },
]

export default async function OlympiaAdminLayout({ children }: { children: ReactNode }) {
  try {
    await ensureOlympiaAdminAccess()
  } catch {
    redirect('/client')
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b bg-slate-900 text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm uppercase tracking-wide text-slate-300">EduSync Olympia</p>
            <h1 className="text-lg font-semibold">Khu vực quản trị</h1>
          </div>
          <nav className="flex gap-4 text-sm">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="text-white/90 transition hover:text-white">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  )
}
