"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

type SearchInputProps = {
  placeholder?: string;
  paramKey?: string;
};

const DEBOUNCE_MS = 300;

/** Debounced search box that syncs to the `q` URL param (spec §13 "URL nên đồng bộ filter"). */
export function SearchInput({ placeholder = "Tìm kiếm...", paramKey = "q" }: SearchInputProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get(paramKey) ?? "");
  const [, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(next: string) {
    setValue(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (next) {
        params.set(paramKey, next);
      } else {
        params.delete(paramKey);
      }
      params.set("page", "1");
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`);
      });
    }, DEBOUNCE_MS);
  }

  return (
    <div className="relative w-full max-w-xs">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-outline" strokeWidth={2} />
      <Input
        value={value}
        onChange={(event) => handleChange(event.target.value)}
        placeholder={placeholder}
        className="h-9 rounded-lg pl-8"
      />
    </div>
  );
}
