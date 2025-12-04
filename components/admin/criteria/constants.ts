export const CRITERIA_CATEGORY_OPTIONS = [
  { value: 'student', label: 'Học sinh' },
  { value: 'class', label: 'Tập thể' },
] as const

export const CRITERIA_TYPE_OPTIONS = [
  { value: 'normal', label: 'Thông thường' },
  { value: 'serious', label: 'Nghiêm trọng' },
  { value: 'critical', label: 'Rất nghiêm trọng' },
] as const

export const CRITERIA_STATUS_OPTIONS = [
  { value: 'active', label: 'Đang dùng' },
  { value: 'inactive', label: 'Ngưng dùng' },
] as const

export type CriteriaCategoryValue = (typeof CRITERIA_CATEGORY_OPTIONS)[number]['value']
export type CriteriaTypeValue = (typeof CRITERIA_TYPE_OPTIONS)[number]['value']
