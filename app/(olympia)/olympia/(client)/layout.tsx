import type { ReactNode } from 'react'
import { OlympiaClientNav } from '@/components/olympia/client/OlympiaClientNav'

export default function OlympiaClientLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100">
      <OlympiaClientNav sticky />
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
    </div>
  )
}
