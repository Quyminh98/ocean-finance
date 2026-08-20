-- Adds 3 more presets to PageStatusColor (user request 2026-08-18: "add
-- orange + 2 more you choose") — ORANGE/PURPLE/PINK, backed by new tokens
-- --color-warning-orange/--color-violet-tag/--color-rose-tag in globals.css
-- (documented in .stitch/DESIGN.md "Tag Accents"). No column changes, no
-- backfill — existing rows keep whatever preset they already had.

ALTER TYPE "PageStatusColor" ADD VALUE 'ORANGE';
ALTER TYPE "PageStatusColor" ADD VALUE 'PURPLE';
ALTER TYPE "PageStatusColor" ADD VALUE 'PINK';
