import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, apiError } from "../lib/api";
import type { Post, PostsResponse } from "../types";

interface QueryResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  setData: React.Dispatch<React.SetStateAction<T | null>>;
}

export function useQuery<T>(url: string | null, options: { enabled?: boolean } = {}): QueryResult<T> {
  const enabled = options.enabled ?? true;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(url) && enabled);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!url || !enabled) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .get<T>(url)
      .then((response) => {
        if (!cancelled) setData(response.data);
      })
      .catch((err) => {
        if (!cancelled) setError(apiError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [url, enabled, nonce]);

  const refetch = useCallback(() => setNonce((value) => value + 1), []);

  return { data, loading, error, refetch, setData };
}

export function usePaginatedPosts(
  basePath: string,
  params: Record<string, string | number | undefined | null> = {},
  limit = 10,
) {
  const paramKey = JSON.stringify(params);
  const query = useMemo(() => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(JSON.parse(paramKey) as Record<string, string | number>)) {
      if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
    }
    search.set("limit", String(limit));
    return search.toString();
  }, [paramKey, limit]);

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const cursorRef = useRef<string | null>(null);
  const pageRef = useRef(2);
  const requestRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestRef.current;
    setLoading(true);
    setError(null);
    setPosts([]);
    setHasMore(true);
    cursorRef.current = null;
    pageRef.current = 2;

    api
      .get<PostsResponse>(`${basePath}?${query}`)
      .then((response) => {
        if (requestRef.current !== requestId) return;
        setPosts(response.data.posts);
        cursorRef.current = response.data.nextCursor;
        setHasMore(
          Boolean(response.data.nextCursor) || Boolean(response.data.meta?.hasMore),
        );
      })
      .catch((err) => {
        if (requestRef.current === requestId) setError(apiError(err));
      })
      .finally(() => {
        if (requestRef.current === requestId) setLoading(false);
      });
  }, [basePath, query, nonce]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return;
    setLoadingMore(true);
    const requestId = requestRef.current;

    try {
      const pagination = cursorRef.current
        ? `cursor=${encodeURIComponent(cursorRef.current)}`
        : `page=${pageRef.current}`;
      const response = await api.get<PostsResponse>(`${basePath}?${query}&${pagination}`);
      if (requestRef.current !== requestId) return;

      setPosts((previous) => {
        const existing = new Set(previous.map((post) => post.id));
        return [...previous, ...response.data.posts.filter((post) => !existing.has(post.id))];
      });

      if (response.data.nextCursor) {
        cursorRef.current = response.data.nextCursor;
      } else {
        cursorRef.current = null;
        pageRef.current += 1;
      }
      setHasMore(
        Boolean(response.data.nextCursor) || Boolean(response.data.meta?.hasMore),
      );
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoadingMore(false);
    }
  }, [basePath, query, loading, loadingMore, hasMore]);

  const refetch = useCallback(() => setNonce((value) => value + 1), []);

  return {
    posts,
    setPosts,
    loading,
    loadingMore,
    hasMore,
    error,
    loadMore,
    refetch,
  };
}

export function useInfiniteScroll(onIntersect: () => void, enabled: boolean) {
  const ref = useRef<HTMLDivElement | null>(null);
  const callbackRef = useRef(onIntersect);
  callbackRef.current = onIntersect;

  useEffect(() => {
    if (!enabled) return;
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) callbackRef.current();
      },
      { rootMargin: "500px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled]);

  return ref;
}

export function useDebounced<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timeout);
  }, [value, delay]);
  return debounced;
}
