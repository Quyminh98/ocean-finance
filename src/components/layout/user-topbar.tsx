import { MobileSidebar } from "@/components/layout/mobile-sidebar";
import { UserSidebarContent } from "@/components/layout/user-sidebar";
import { BackgroundMusicPlayer } from "@/components/layout/background-music-player";

/**
 * Fixed top bar shown above User content — mirrors Admin's `Topbar` exactly
 * (user request 2026-08-19: nav moved to a left sidebar "giống admin").
 * No account dropdown/avatar here — removed entirely (user request
 * 2026-08-19); logout stays reachable via the Sidebar's own
 * `SidebarLogoutButton`.
 */
export function UserTopbar() {
  return (
    <header className="fixed right-0 top-0 z-10 flex h-16 w-full items-center justify-between border-b border-border-subtle bg-surface/90 px-gutter backdrop-blur-md lg:ml-65 lg:w-[calc(100%-260px)]">
      <MobileSidebar>
        <UserSidebarContent />
      </MobileSidebar>
      <div className="ml-auto flex items-center gap-2">
        <p className="hidden font-body-md text-xs italic text-on-surface-variant sm:block">
          “Nếu dash 🔴 quá, bấm play”
        </p>
        <span className="hidden text-lg sm:inline" aria-hidden="true">
          👉
        </span>
        <BackgroundMusicPlayer />
      </div>
    </header>
  );
}
