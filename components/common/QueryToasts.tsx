"use client"

import { useEffect } from "react"
import { toast } from "sonner"

export type QueryToastsProps = {
  ok?: string
  error?: string
}

function resolveSuccessMessage(code?: string) {
  switch (code) {
    case '1':
      return 'Đã ghi nhận.'
    case 'criteria-created':
      return 'Đã tạo tiêu chí mới.'
    case 'criteria-updated':
      return 'Đã cập nhật tiêu chí.'
    case 'criteria-disabled':
      return 'Đã ngưng sử dụng tiêu chí.'
    case 'criteria-restored':
      return 'Đã kích hoạt lại tiêu chí.'
    case 'criteria-deleted':
      return 'Đã xóa tiêu chí.'
    default:
      return undefined
  }
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
    case 'inactive_criteria':
      return 'Tiêu chí này đã bị ngưng sử dụng.'
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
    const msg = resolveSuccessMessage(ok)
    if (msg) toast.success(msg)
  }, [ok])

  useEffect(() => {
    const msg = resolveErrorMessage(error)
    if (msg) {
      toast.error(msg)
    }
  }, [error])

  return null
}
