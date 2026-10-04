import { CheckCircle2, CircleDot, Clock, Lock } from "lucide-react";
import { cn } from "@/lib/cn";
import { SUPPORT_STATUS_CLASS, SUPPORT_STATUS_LABEL, type SupportStatus } from "@/lib/support";

const ICON = { open: Clock, in_progress: CircleDot, resolved: CheckCircle2, closed: Lock } as const;

export function SupportStatusBadge({ status }: { status: SupportStatus }) {
  const Icon = ICON[status];
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-pill border px-2 py-0.5 text-xs font-medium", SUPPORT_STATUS_CLASS[status])}>
      <Icon className="h-3 w-3" /> {SUPPORT_STATUS_LABEL[status]}
    </span>
  );
}
