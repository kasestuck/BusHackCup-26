"use client";

import { useCallback, useEffect, useState } from "react";
import type { z } from "zod";
import { apiRequest, type ApiError, type ApiResult } from "./api";

export type ApiState<T> =
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: ApiError };

/** In-flight / settled GET requests, shared so the shell and page don't double-fetch. */
const cache = new Map<string, Promise<ApiResult<unknown>>>();

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

/** Drop cached GETs (e.g. after a mutation changes the balance). */
export function invalidateApi(path?: string) {
  if (path) cache.delete(path);
  else cache.clear();
}

/** GET a contract-typed endpoint. Pass `null` to skip the request. */
export function useApi<S extends z.ZodType>(path: string | null, schema: S) {
  const [state, setState] = useState<ApiState<z.infer<S>>>({ status: "loading" });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!path) return;
    let active = true;
    load(path, schema).then((r) => {
      if (!active) return;
      setState(r.ok ? { status: "success", data: r.data } : { status: "error", error: r.error });
    });
    return () => {
      active = false;
    };
  }, [path, schema, nonce]);

  const retry = useCallback(() => {
    if (path) cache.delete(path);
    setState({ status: "loading" });
    setNonce((n) => n + 1);
  }, [path]);

  return [state, retry] as const;
}
