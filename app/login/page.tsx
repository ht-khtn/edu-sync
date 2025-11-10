import LoginForm from '@/components/login/LoginForm'

export const metadata = {
  title: 'Đăng nhập — EduSync',
}

export default function LoginPage() {
  // Server Component: do NOT add 'use client' here
  return <LoginForm />
}
