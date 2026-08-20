import { cn } from "@/lib/utils";
import { auditActionLabel, auditActionTone, type AuditTone } from "@/lib/audit-labels";
import type { AuditActorType } from "@/generated/prisma/client";

// Same visual language as status-chip.tsx ("Status Chips" in DESIGN.md), but
// keyed on action verbs / actor kind instead of an entity's business status —
// distinct semantic dimension, so kept as a separate component.
const toneClasses: Record<AuditTone, string> = {
  success: "bg-surface-ice text-success-green",
  info: "bg-secondary-container/50 text-secondary",
  error: "bg-error-container text-error-red",
  neutral: "bg-surface-container text-on-surface-variant",
};

function Chip({ tone, children }: { tone: AuditTone; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded px-2 py-0.5 font-label-caps text-label-caps uppercase", toneClasses[tone])}>
      {children}
    </span>
  );
}

export function AuditActionChip({ action }: { action: string }) {
  return <Chip tone={auditActionTone(action)}>{auditActionLabel(action)}</Chip>;
}

/** Distinguishes Web (Admin) actions from AI/MCP actions (plan Phase 12 note #4) — Finance Blue marks the AI actor per DESIGN.md's "interactive data points" usage. */
export function AuditActorTypeChip({ actorType }: { actorType: AuditActorType }) {
  if (actorType === "MCP") {
    return (
      <span className="inline-flex items-center rounded bg-surface-ice px-2 py-0.5 font-label-caps text-label-caps uppercase text-finance-blue">
        MCP
      </span>
    );
  }
  return <Chip tone="neutral">USER</Chip>;
}
