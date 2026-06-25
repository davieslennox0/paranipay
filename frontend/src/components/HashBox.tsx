import type { ReactNode } from "react";

export function HashBox({ children }: { children: ReactNode }) {
  return <div className="hash-box">{children}</div>;
}

export function truncate(value: string, head = 10, tail = 8): string {
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}
