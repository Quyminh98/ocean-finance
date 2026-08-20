"use client"

import * as React from "react"
import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox"
import { ChevronsUpDownIcon, CheckIcon, XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export type ComboboxOption = { value: string; label: string }

type ComboboxProps = {
  id?: string
  options: ComboboxOption[]
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  emptyText?: string
  disabled?: boolean
  className?: string
}

/**
 * Searchable single-select — wraps Base UI's `Combobox` (verified via Context7
 * before use, per CLAUDE.md). Kept as a plain `value`/`onValueChange: string`
 * API (like `Select`) instead of exposing the underlying `{value, label}`
 * item objects, so it drops into the same `Controller`/RHF wiring used
 * everywhere `Select` is today, without touching call sites' form schemas.
 */
function Combobox({
  id,
  options,
  value,
  onValueChange,
  placeholder = "Tìm kiếm...",
  emptyText = "Không tìm thấy kết quả.",
  disabled,
  className,
}: ComboboxProps) {
  const selected = options.find((option) => option.value === value) ?? null

  return (
    <ComboboxPrimitive.Root
      items={options}
      value={selected}
      onValueChange={(item: ComboboxOption | null) => onValueChange(item?.value ?? "")}
      isItemEqualToValue={(a: ComboboxOption, b: ComboboxOption) => a?.value === b?.value}
      disabled={disabled}
    >
      <ComboboxPrimitive.InputGroup
        className={cn(
          "flex h-10 w-full items-center gap-1 rounded-lg border border-input bg-transparent pr-1 pl-2.5 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 data-disabled:cursor-not-allowed data-disabled:opacity-50",
          className
        )}
      >
        <ComboboxPrimitive.Input
          id={id}
          placeholder={placeholder}
          className="h-full flex-1 bg-transparent text-sm outline-none placeholder:text-outline disabled:cursor-not-allowed"
        />
        <ComboboxPrimitive.Clear className="flex size-7 items-center justify-center rounded text-on-surface-variant hover:bg-surface-container">
          <XIcon className="size-3.5" />
        </ComboboxPrimitive.Clear>
        <ComboboxPrimitive.Trigger className="flex size-7 items-center justify-center rounded text-on-surface-variant hover:bg-surface-container">
          <ChevronsUpDownIcon className="size-3.5" />
        </ComboboxPrimitive.Trigger>
      </ComboboxPrimitive.InputGroup>

      <ComboboxPrimitive.Portal>
        <ComboboxPrimitive.Positioner sideOffset={4} className="isolate z-50 w-(--anchor-width)">
          <ComboboxPrimitive.Popup className="max-h-72 w-full overflow-x-hidden overflow-y-auto rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <ComboboxPrimitive.Empty className="empty:hidden px-3 py-6 text-center text-sm text-on-surface-variant">
              {emptyText}
            </ComboboxPrimitive.Empty>
            <ComboboxPrimitive.List className="p-1">
              {(option: ComboboxOption) => (
                <ComboboxPrimitive.Item
                  key={option.value}
                  value={option}
                  className="relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1.5 pr-8 pl-2.5 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                >
                  {option.label}
                  <ComboboxPrimitive.ItemIndicator className="absolute right-2 flex size-4 items-center justify-center">
                    <CheckIcon className="size-3.5" />
                  </ComboboxPrimitive.ItemIndicator>
                </ComboboxPrimitive.Item>
              )}
            </ComboboxPrimitive.List>
          </ComboboxPrimitive.Popup>
        </ComboboxPrimitive.Positioner>
      </ComboboxPrimitive.Portal>
    </ComboboxPrimitive.Root>
  )
}

export { Combobox }
