import type { ReactNode } from 'react'
import { OlympiaClientContentWrapper } from '@/components/olympia/client/layout/OlympiaClientContentWrapper'

export default function OlympiaClientLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <main className="min-h-screen">
        <OlympiaClientContentWrapper>{children}</OlympiaClientContentWrapper>
      </main>
    </div>
  )
}
