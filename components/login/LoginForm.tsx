"use client";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { getSupabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormItem,
  FormControl,
  FormLabel,
  FormMessage,
  FormField,
} from "@/components/ui/form";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

type LoginValues = {
  email: string;
  password: string;
  remember: boolean;
};

export default function LoginForm() {
  const form = useForm<LoginValues>({
    defaultValues: { email: "", password: "", remember: false },
  });
  const { control, watch } = form;
  const watched = watch(["email", "password"]);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      console.log("Data:", data, "Error:", error);
      if (error) {
        const msg = error.message || "Đăng nhập thất bại";
        if (msg.toLowerCase().includes("invalid login credentials")) {
          setError("Sai email hoặc mật khẩu. Vui lòng kiểm tra lại.");
          toast.error("Sai email hoặc mật khẩu");
        } else if (msg.toLowerCase().includes("user not found")) {
          setError("Tài khoản không tồn tại. Vui lòng kiểm tra lại hoặc liên hệ quản trị viên.");
          toast.error("Tài khoản không tồn tại");
        } else {
          setError(msg);
          toast.error("Đăng nhập thất bại");
        }
      } else {
        const access_token = data.session?.access_token;
        const refresh_token = data.session?.refresh_token;
        const expires_in = data.session?.expires_in;

        if (!access_token || !refresh_token) {
          await supabase.auth.signOut();
          setError("Không thể thiết lập phiên đăng nhập. Vui lòng thử lại.");
          toast.error("Thiết lập phiên thất bại");
          return;
        }

        // Parallelize: start both setSession and getSession in parallel (truly independent)
        const [setSessionRes, profileRes] = await Promise.all([
          fetch("/api/auth/set-session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ access_token, refresh_token, expires_in }),
          }),
          fetch("/api/session", {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          }),
        ]);

        if (!setSessionRes.ok) {
          await supabase.auth.signOut();
          setError("Không thể thiết lập phiên đăng nhập. Vui lòng thử lại.");
          toast.error("Thiết lập phiên thất bại");
          return;
        }

        if (!profileRes.ok) {
          await supabase.auth.signOut();
          setError("Không thể xác thực tài khoản trong hệ thống. Vui lòng thử lại sau.");
          toast.error("Không thể kiểm tra tài khoản hệ thống");
          return;
        }

        let profileJson = await profileRes.json();
        
        // Retry logic: if user not found, it may be due to DB trigger delay
        if (!profileJson?.user || !profileJson.user.id) {
          // Retry up to 3 times with delays
          let retries = 0;
          const maxRetries = 3;
          
          while ((!profileJson?.user || !profileJson.user.id) && retries < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 300));
            
            const retryRes = await fetch("/api/session", {
              method: "GET",
              credentials: "include",
              cache: "no-store",
            });
            
            if (retryRes.ok) {
              profileJson = await retryRes.json();
            }
            retries++;
          }
          
          // If still not found after retries
          if (!profileJson?.user || !profileJson.user.id) {
            await supabase.auth.signOut();
            setError("Tài khoản không tồn tại hoặc chưa được kích hoạt trong hệ thống. Vui lòng liên hệ quản trị viên.");
            toast.error("Tài khoản không tồn tại hoặc chưa được kích hoạt");
            return;
          }
        }

        // Use window.location for hard redirect to ensure cookies are read by server-side middleware
        // This ensures proxy.ts can detect the authenticated user immediately
        window.location.href = "/";
        toast.success("Đăng nhập thành công");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Lỗi không xác định";
      setError(message);
      toast.error("Đăng nhập lỗi: " + message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto overflow-hidden border border-neutral-200/60 shadow-lg bg-white/90 backdrop-blur supports-backdrop-filter:bg-white/70">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-2xl font-semibold bg-clip-text text-transparent bg-linear-to-r from-indigo-600 to-purple-600">
          Đăng nhập
        </CardTitle>
        <p className="text-sm text-neutral-600">
          Chào mừng trở lại! Vui lòng nhập thông tin để tiếp tục.
        </p>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            noValidate
            className="space-y-5"
          >
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
                <FormItem className="space-y-2">
                  <FormLabel htmlFor="password" className="text-sm font-medium">
                    Mật khẩu
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        placeholder="••••••••"
                        disabled={loading}
                        className="pr-12"
                        {...field}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setShowPassword((s) => !s)}
                        aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                        className="absolute inset-y-0 right-0 h-full px-3 text-neutral-500 hover:text-neutral-700"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
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
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={loading || !watched[0] || !watched[1]}
              className="w-full font-medium bg-indigo-600 text-white border border-indigo-700 hover:bg-indigo-700"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Đăng
              nhập
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
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
