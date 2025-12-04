import React from "react"
import ScoreEntryClient from "@/components/admin/score/ScoreEntryClient"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

export default function ScoreEntryPageContent() {
  return (
    <main className="p-6 max-w-6xl mx-auto">
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Nhập điểm hoạt động</CardTitle>
          <CardDescription>Tải CSV và gửi batch điểm theo hoạt động.</CardDescription>
        </CardHeader>
        <CardContent>
          <ScoreEntryClient />
        </CardContent>
      </Card>
    </main>
  )
}
