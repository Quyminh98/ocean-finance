"use client";

import { usePathname } from "next/navigation";

/**
 * Subtle fade-in on route change (DESIGN.md "Animation nhẹ... không dùng
 * thư viện ngoài") — `key={pathname}` remounts the wrapper (and its
 * server-rendered children) per navigation so the CSS enter animation
 * replays; harmless here since each route's page.tsx already re-fetches
 * fresh data on navigation regardless.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="animate-in fade-in duration-200">
      {children}
    </div>
  );
}
