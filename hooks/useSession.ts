"use client";

import { useEffect, useState, useCallback, useRef } from "react";

export type SessionUser = {
  id: string;
};

export type SessionInfo = {
  user: SessionUser | null;
  hasCC?: boolean;
  hasSchoolScope?: boolean;
  hasOlympiaAccess?: boolean;
  ccClassId?: string | null;
  roles?: string[];
};

export type UseSessionResult = {
  data: SessionInfo | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

// Tăng interval để giảm spam /api/session khi nhiều component mount.
// Nếu cần cập nhật ngay, dùng refetch().
const MIN_FETCH_INTERVAL = 15000; // ms

type SharedCache = {
  inflight: Promise<SessionInfo | null> | null;
  value: SessionInfo | null;
  lastFetchAt: number;
};

const sharedCache: SharedCache = {
  inflight: null,
  value: null,
  lastFetchAt: 0,
};

async function fetchSessionShared(force: boolean): Promise<SessionInfo | null> {
  const now = Date.now();

  if (!force) {
    if (sharedCache.inflight) return await sharedCache.inflight;
    if (sharedCache.value && now - sharedCache.lastFetchAt < MIN_FETCH_INTERVAL)
      return sharedCache.value;
  }

  const doFetch = async (): Promise<SessionInfo | null> => {
    const res = await fetch("/api/session", { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Session fetch failed: ${res.status}`);
    }
    const json = (await res.json()) as SessionInfo;
    return json;
  };

  const p: Promise<SessionInfo | null> = doFetch()
    .then((json) => {
      sharedCache.value = json;
      sharedCache.lastFetchAt = Date.now();
      return json;
    })
    .catch(() => {
      sharedCache.lastFetchAt = Date.now();
      return sharedCache.value;
    })
    .finally(() => {
      if (sharedCache.inflight === p) sharedCache.inflight = null;
    });

  sharedCache.inflight = p;
  return await p;
}

/**
 * Hook to get current session info from /api/session
 * Provides loading state, error handling, and refetch capability
 */
export function useSession(): UseSessionResult {
  const [data, setData] = useState<SessionInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchingRef = useRef(false);
  const lastFetchAtRef = useRef(0);
  const hasDataRef = useRef(false);

  const fetchSession = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force) {
      if (fetchingRef.current) return;
      if (now - lastFetchAtRef.current < MIN_FETCH_INTERVAL) return;
    }

    fetchingRef.current = true;
    lastFetchAtRef.current = now;

    // Only show loading if we don't have data yet
    if (!hasDataRef.current) {
      setIsLoading(true);
    }
    setIsError(false);
    setError(null);

    try {
      const json = await fetchSessionShared(force);
      setData(json);
      hasDataRef.current = true;
      if (json) {
        try {
          localStorage.setItem("edu-sync-session", JSON.stringify(json));
        } catch {}
      }
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error("Unknown error");
      setIsError(true);
      setError(errorObj);
      // Nếu fetch fail nhưng đã có cache (localStorage/shared), vẫn giữ lại.
      setData((prev) => prev);
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    // Hydrate from localStorage to avoid sidebar flash
    try {
      const cached = localStorage.getItem("edu-sync-session");
      if (cached) {
        const parsed = JSON.parse(cached) as SessionInfo;
        setData(parsed);
        hasDataRef.current = true;
        setIsLoading(false);
      }
    } catch {}

    // Không force fetch ở mount để tránh spam /api/session khi route refresh.
    // fetchSessionShared() sẽ trả cache nhanh nếu còn trong MIN_FETCH_INTERVAL.
    fetchSession(false);
  }, [fetchSession]);

  return {
    data,
    isLoading,
    isError,
    error,
    refetch: () => fetchSession(true),
  };
}
