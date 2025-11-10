"use client";
import { useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormItem, FormControl, FormLabel, FormMessage } from "@/components/ui/form";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const errorRef = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.focus();
    }
  }, [error]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const supabase = await getSupabase();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setError(error.message);
      } else {
        // Persist session preference if needed (Supabase handles by default)
        if (remember) {
          // Could add custom logic later
        }
        router.push("/");
      }
    } catch (err: any) {
      setError(err?.message ?? "Lỗi không xác định");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto overflow-hidden border border-neutral-200/60 shadow-lg bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-2xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
          Đăng nhập
        </CardTitle>
        <p className="text-sm text-neutral-600">
          Chào mừng trở lại! Vui lòng nhập thông tin để tiếp tục.
        </p>
      </CardHeader>
      <CardContent>
        <Form onSubmit={onSubmit} noValidate className="space-y-5">
          <FormItem className="space-y-2">
            <FormLabel htmlFor="email" className="text-sm font-medium">Email</FormLabel>
            <FormControl>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                placeholder="ten-ban@vidu.com"
              />
            </FormControl>
          </FormItem>
          <FormItem className="space-y-2">
            <FormLabel htmlFor="password" className="text-sm font-medium">Mật khẩu</FormLabel>
            <FormControl className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                placeholder="••••••••"
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                className="absolute inset-y-0 right-0 h-auto px-3 text-neutral-500 hover:text-neutral-700"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </FormControl>
          </FormItem>
          <FormItem className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 select-none cursor-pointer">
              <Checkbox
                checked={remember}
                onCheckedChange={(val) => setRemember(val)}
                disabled={loading}
                aria-label="Ghi nhớ tôi"
              />
              <span>Ghi nhớ tôi</span>
            </label>
            <a
              href="/reset-password"
              className="text-indigo-600 hover:text-indigo-500 font-medium hover:underline"
            >
              Quên mật khẩu?
            </a>
          </FormItem>
          {error && (
            <FormMessage
              ref={errorRef}
              role="alert"
              tabIndex={-1}
              aria-live="assertive"
              className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs sm:text-sm text-red-700"
            >
              <AlertCircle className="h-4 w-4 mt-[2px] flex-shrink-0" />
              {error}
            </FormMessage>
          )}
          <Button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full font-medium"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Đăng nhập
          </Button>
          <FormItem className="pt-1 text-center text-xs sm:text-sm text-neutral-600">
            Chưa có tài khoản?{" "}
            <a
              href="/register"
              className="text-indigo-600 hover:text-indigo-500 font-medium hover:underline"
            >
              Đăng ký ngay
            </a>
          </FormItem>
        </Form>
      </CardContent>
    </Card>
  );
}
