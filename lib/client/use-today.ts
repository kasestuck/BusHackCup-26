"use client";

import { useSyncExternalStore } from "react";

let cached: Date | null = null;
const subscribe = () => () => {};
const getSnapshot = () => (cached ??= new Date());
const getServerSnapshot = () => null;

/**
 * The viewer's local "now", read on the client only (null during prerender),
 * so weekday logic always uses the user's timezone and never causes a hydration mismatch.
 */
export function useToday(): Date | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
