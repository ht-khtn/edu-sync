"use client"

import React from 'react'

type Props = { children: React.ReactNode }

export default class ErrorBoundary extends React.Component<Props, { hasError: boolean; error?: any }> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error }
  }

  componentDidCatch(error: any, info: any) {
    // Log to console — client devs can inspect stack
    // In production you might post to an error tracking endpoint
    // eslint-disable-next-line no-console
    console.error('Client ErrorBoundary caught error', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 rounded border bg-red-50 text-red-700">
          <div className="font-medium">Có lỗi xảy ra trên trang (client).</div>
          <div className="text-sm mt-1">Mở console trình duyệt để xem chi tiết.</div>
        </div>
      )
    }
    return this.props.children
  }
}
