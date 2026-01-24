import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { OlympiaAdminPathSaver } from '@/components/olympia/admin/layout/OlympiaAdminPathSaver'

export const metadata: Metadata = {
  title: 'EduSync Olympia',
  description: 'Khu vực thi Olympia dành cho ban tổ chức và thí sinh.',
}

export default function OlympiaRootLayout({ children }: { children: ReactNode }) {
  return (
    <OlympiaAdminPathSaver>
      <div className="min-h-screen bg-slate-50 text-slate-900">
        {children}
      </div>
    </OlympiaAdminPathSaver>
  )
}

