"use client"

import { useEffect } from "react"
import { toast } from "sonner"

export type QueryToastsProps = {
  ok?: string
  error?: string
}

function resolveErrorMessage(code?: string) {
  switch (code) {
    case "missing":
      return "Thiếu dữ liệu bắt buộc."
    case "nouser":
      return "Không tìm thấy người dùng trong hệ thống."
    case "nostudent":
      return "Không tìm thấy học sinh."
    case "nocriteria":
      return "Không tìm thấy tiêu chí."
    case "insert":
      return "Lỗi khi ghi nhận, vui lòng thử lại."
    case "forbidden":
      return "Bạn không có quyền ghi nhận cho lớp này."
    default:
      return code ? "Đã xảy ra lỗi." : undefined
  }
}

export default function QueryToasts({ ok, error }: QueryToastsProps) {
  useEffect(() => {
    if (ok === "1") {
      toast.success("Đã ghi nhận.")
    }
  }, [ok])

  useEffect(() => {
    const msg = resolveErrorMessage(error)
    if (msg) {
      toast.error(msg)
    }
  }, [error])

  return null
}
