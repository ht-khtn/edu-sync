// docs/scripts/seed-admins/config.ts
// Cấu hình tài khoản admin cần seed. Chỉnh sửa thông tin trước khi chạy script.

export type AdminSeedConfig = {
  email: string
  username?: string
  password?: string
  roleId: string
  roleTarget?: string | null
  classId?: string | null
}

export const adminAccount: AdminSeedConfig = {
  email: 'bch@edusync.edu.vn',
  username: 'bch',
  password: '123',
  roleId: 'SEC',
  roleTarget: null,
  classId: null,
}
