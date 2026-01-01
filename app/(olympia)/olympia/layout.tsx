import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'EduSync Olympia',
  description: 'Khu vực thi Olympia dành cho ban tổ chức và thí sinh.',
}

export default function OlympiaRootLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-black text-white">
      {children}
    </div>
  )
}
