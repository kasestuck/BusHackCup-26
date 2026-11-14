"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { z } from "zod";
import { apiRequest, type ApiError, type ApiResult } from "./api";

export type ApiState<T> =
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: ApiError };

/** In-flight / settled GET requests, shared so the shell and page don't double-fetch. */
const cache = new Map<string, Promise<ApiResult<unknown>>>();

/** Mounted hooks, told to refetch when their data is invalidated. */
const listeners = new Set<(path?: string) => void>();

function load<S extends z.ZodType>(path: string, schema: S) {
  let p = cache.get(path);
  if (!p) {
    p = apiRequest(path, schema);
    cache.set(path, p);
    // Failed requests must not stick: the next mount or retry asks again.
    p.then((r) => {
      if (!r.ok) cache.delete(path);
    });
  }
  return p as Promise<ApiResult<z.infer<S>>>;
}

/**
 * Drop cached GETs after a mutation (balance, plan, Pro status changed).
 * Hooks already on screen refetch in the background and keep showing
 * their current data until the fresh response arrives.
 */
export function invalidateApi(path?: string) {
  if (path) cache.delete(path);
  else cache.clear();
  listeners.forEach((fn) => fn(path));
}

/** GET a contract-typed endpoint. Pass `null` to skip the request. */
export function useApi<S extends z.ZodType>(path: string | null, schema: S) {
  const [state, setState] = useState<ApiState<z.infer<S>>>({ status: "loading" });
  const [nonce, setNonce] = useState(0);
  const hasData = useRef(false);

  useEffect(() => {
    if (!path) return;
    let active = true;
    load(path, schema).then((r) => {
      if (!active) return;
      if (r.ok) {
        hasData.current = true;
        setState({ status: "success", data: r.data });
      } else if (!hasData.current) {
        // A failed background refresh keeps the data already on screen.
        setState({ status: "error", error: r.error });
      }
    });
    return () => {
      active = false;
    };
  }, [path, schema, nonce]);

  useEffect(() => {
    if (!path) return;
    const onInvalidate = (p?: string) => {
      if (!p || p === path) setNonce((n) => n + 1);
    };
    listeners.add(onInvalidate);
    return () => {
      listeners.delete(onInvalidate);
    };
  }, [path]);

  const retry = useCallback(() => {
    if (path) cache.delete(path);
    hasData.current = false;
    setState({ status: "loading" });
    setNonce((n) => n + 1);
  }, [path]);

  return [state, retry] as const;
}
