import LoginForm from '@/components/login/LoginForm'

export const metadata = {
  title: 'Đăng nhập — EduSync',
}

export default function LoginPage() {
  // Server Component: do NOT add 'use client' here
  return (
    <div className="min-h-[100dvh] w-full p-4 grid place-items-center bg-[radial-gradient(60%_60%_at_50%_0%,rgba(99,102,241,0.10),rgba(255,255,255,0)),linear-gradient(180deg,rgba(124,58,237,0.05)_0%,rgba(255,255,255,0)_30%)]">
      <LoginForm />
    </div>
  )
}
