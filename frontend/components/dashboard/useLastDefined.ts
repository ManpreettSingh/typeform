"use client";

import { useState } from "react";

/** Keeps the last non-null value so a closing modal can still render its content while it animates out. */
export function useLastDefined<T>(value: T | null): T | null {
  const [last, setLast] = useState(value);
  if (value !== null && value !== last) setLast(value);
  return value ?? last;
}
