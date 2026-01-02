// Minimal Supabase client helper (singleton)
// Avoid creating many Supabase clients (each would register auth listeners & refresh timers → request explosion)
// Usage: import { getSupabase } from '@/lib/supabase'
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "@/configs/env";

let browserClient: SupabaseClient | null = null;
let browserClientPromise: Promise<SupabaseClient> | null = null;
let lastAccessToken: string | null = null;

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const needle = `${encodeURIComponent(name)}=`;
  const parts = document.cookie.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith(needle)) {
      return decodeURIComponent(trimmed.slice(needle.length));
    }
  }
  return null;
}

export async function getSupabase(): Promise<SupabaseClient> {
  if (browserClient) {
    const currentToken = readCookie("sb-access-token-public") ?? readCookie("sb-access-token");
    // Nếu client được tạo trước khi có token (hoặc token đổi), Storage/Realtime sẽ chạy với role sai.
    // Rebuild client để cập nhật Authorization header.
    if ((currentToken ?? null) !== lastAccessToken) {
      browserClient = null;
      lastAccessToken = null;
    } else {
      return browserClient;
    }
  }
  if (browserClientPromise) return browserClientPromise;
  if (typeof window === "undefined") {
    throw new Error(
      "getSupabase() should only be called client-side. Use getSupabaseServer() on the server."
    );
  }

  // Create client once and reuse; guard concurrent calls with a promise
  browserClientPromise = (async () => {
    const { url, anonKey } = getSupabasePublicEnv();
    // Server dùng cookie `sb-access-token` để set Authorization.
    // Browser cũng cần token này để nhận Realtime events (RLS) mà không phải reload.
    const accessToken = readCookie("sb-access-token-public") ?? readCookie("sb-access-token");
    const client = createClient(url, anonKey, {
      global: {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      },
      auth: {
        // persistSession keeps session in localStorage/cookies
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    if (accessToken) {
      try {
        // Realtime cần auth riêng; setAuth giúp channel dùng JWT hiện tại.
        const realtime = (client as unknown as { realtime?: { setAuth?: (token: string) => void } })
          .realtime;
        realtime?.setAuth?.(accessToken);
      } catch {
        // ignore: không phải bản supabase-js nào cũng expose setAuth
      }
    }
    lastAccessToken = accessToken ?? null;
    browserClient = client;
    browserClientPromise = null;
    return client;
  })();

  return browserClientPromise;
}

export default getSupabase;
