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
  email: 'mod@edusync.edu.vn',
  username: 'mod',
  password: '123',
  roleId: 'MOD',
  roleTarget: 'school',
  classId: null,
}
