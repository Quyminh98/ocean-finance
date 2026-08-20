import { MobileSidebar } from "@/components/layout/mobile-sidebar";
import { SidebarContent } from "@/components/layout/sidebar";
import { BackgroundMusicPlayer } from "@/components/layout/background-music-player";

/** Fixed top bar shown above Admin content — mirrors the Stitch "TopAppBar" reference. */
export function Topbar() {
  return (
    <header className="fixed right-0 top-0 z-10 flex h-16 w-full items-center justify-between border-b border-border-subtle bg-surface/90 px-gutter backdrop-blur-md lg:ml-65 lg:w-[calc(100%-260px)]">
      <MobileSidebar>
        <SidebarContent />
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
