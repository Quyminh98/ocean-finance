"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  pageSizeOptions?: readonly number[];
};

/** Server-side pagination control, URL-synced via `page`/`pageSize` query params (spec §42). */
export function Pagination({ page, pageSize, total, pageSizeOptions = [20, 50, 100] }: PaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function navigate(nextPage: number, nextPageSize: number = pageSize) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(nextPage));
    params.set("pageSize", String(nextPageSize));
    router.push(`${pathname}?${params.toString()}`);
  }

  if (total === 0) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-stack-sm border-t border-border-subtle px-card-padding py-stack-sm">
      <p className="font-body-md text-body-md text-on-surface-variant">
        Hiển thị {start}–{end} trên {total}
      </p>
      <div className="flex items-center gap-stack-md">
        <div className="flex items-center gap-stack-sm">
          <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">Số dòng</span>
          <Select value={String(pageSize)} onValueChange={(value) => navigate(1, Number(value))}>
            <SelectTrigger size="sm" className="w-18">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => navigate(page - 1)}>
            <ChevronLeft className="size-4" strokeWidth={2} />
          </Button>
          <span className="min-w-16 text-center font-data-tabular text-data-tabular text-on-surface">
            {page} / {totalPages}
          </span>
          <Button variant="outline" size="icon-sm" disabled={page >= totalPages} onClick={() => navigate(page + 1)}>
            <ChevronRight className="size-4" strokeWidth={2} />
          </Button>
        </div>
      </div>
    </div>
  );
}
