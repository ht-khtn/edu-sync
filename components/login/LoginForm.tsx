"use client";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { getSupabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormItem, FormControl, FormLabel, FormMessage, FormField } from "@/components/ui/form";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";

type LoginValues = {
  email: string;
  password: string;
  remember: boolean;
};

export default function LoginForm() {
  const form = useForm<LoginValues>({
    defaultValues: { email: "", password: "", remember: false },
  });
  const { control } = form;
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const errorRef = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.focus();
    }
  }, [error]);

  async function onSubmit(values: LoginValues) {
    setLoading(true);
    setError(null);
    try {
      const supabase = await getSupabase();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: values.email.trim(),
        password: values.password,
      });
      if (error) {
        setError(error.message);
      } else {
        // Persist session to server-side cookies so server components can read auth state
        try {
          const access_token = (data as any)?.session?.access_token
          const refresh_token = (data as any)?.session?.refresh_token
          const expires_in = (data as any)?.session?.expires_in
          if (access_token && refresh_token) {
            await fetch('/api/auth/set-session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ access_token, refresh_token, expires_in }),
            })
          }
        } catch (e) {
          // ignore cookie set failures; still continue with client-side session
        }
        // persist session preference if needed
        if (values.remember) {
          // custom logic can be added here
        }
        // navigate to dashboard
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
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-5">
            <FormField
              control={control}
              name="email"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel htmlFor="email" className="text-sm font-medium">
                    Email
                  </FormLabel>
                  <FormControl>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="ten-ban@vidu.com"
                      disabled={loading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="password"
              render={({ field }) => (
                <FormItem className="space-y-2 relative">
                  <FormLabel htmlFor="password" className="text-sm font-medium">
                    Mật khẩu
                  </FormLabel>
                  <FormControl>
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      disabled={loading}
                      className="pr-10"
                      {...field}
                    />
                  </FormControl>
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
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="remember"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between text-sm">
                  <FormControl>
                    <Checkbox
                      checked={!!field.value}
                      onCheckedChange={(v) => field.onChange(v === true)}
                      disabled={loading}
                      aria-label="Ghi nhớ tôi"
                    />
                  </FormControl>
                  <a
                    href="/reset-password"
                    className="text-indigo-600 hover:text-indigo-500 font-medium hover:underline"
                  >
                    Quên mật khẩu?
                  </a>
                </FormItem>
              )}
            />

            {error && (
              <p
                ref={errorRef}
                role="alert"
                tabIndex={-1}
                aria-live="assertive"
                className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs sm:text-sm text-red-700"
              >
                <AlertCircle className="h-4 w-4 mt-[2px] flex-shrink-0" />
                {error}
              </p>
            )}

            <Button type="submit" disabled={loading || !form.getValues("email") || !form.getValues("password")} className="w-full font-medium">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Đăng nhập
            </Button>

            <FormItem className="pt-1 text-center text-xs sm:text-sm text-neutral-600">
              Chưa có tài khoản?{" "}
              <a href="/register" className="text-indigo-600 hover:text-indigo-500 font-medium hover:underline">
                Đăng ký ngay
              </a>
            </FormItem>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
