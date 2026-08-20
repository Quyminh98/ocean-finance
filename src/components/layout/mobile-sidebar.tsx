"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

/**
 * Off-canvas nav for tablet/mobile (<lg) — wraps the same sidebar content
 * rendered by `Sidebar`/`UserSidebar` on desktop, shown via a hamburger
 * trigger in the Topbar. Closes automatically on route change (Base UI
 * Dialog has no built-in "close on navigate", nav links don't call
 * onOpenChange) — resets `open` during render on pathname change per React's
 * "adjusting state when a prop changes" pattern, not a useEffect (avoids the
 * cascading-render lint rule and the extra render an effect would cost).
 */
export function MobileSidebar({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [prevPathname, setPrevPathname] = useState(pathname);

  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="text-on-surface-variant hover:text-on-surface lg:hidden"
          />
        }
      >
        <Menu className="size-5" strokeWidth={2} />
        <span className="sr-only">Mở menu điều hướng</span>
      </SheetTrigger>
      <SheetContent side="left" className="w-65 max-w-[80vw] gap-0 border-none bg-sidebar p-0">
        <SheetTitle className="sr-only">Menu điều hướng</SheetTitle>
        <div className="flex h-full flex-col py-gutter">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
