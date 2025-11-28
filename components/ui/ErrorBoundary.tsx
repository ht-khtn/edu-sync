"use client"

import React from 'react'

type Props = { children: React.ReactNode }
type ErrorState = { hasError: boolean; error?: Error | null }

export default class ErrorBoundary extends React.Component<Props, ErrorState> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
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
