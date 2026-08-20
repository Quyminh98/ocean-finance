import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

type PageHeaderProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** Shows a "back" icon button above the title, linking here — e.g. a Detail page's List route. */
  backHref?: string;
};

export function PageHeader({ title, description, action, backHref }: PageHeaderProps) {
  return (
    <div className="mb-stack-md flex flex-wrap items-end justify-between gap-stack-sm">
      <div>
        {backHref ? (
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link href={backHref} />}
            className="mb-1 -ml-2.5 text-on-surface-variant hover:text-on-surface"
          >
            <ArrowLeft className="size-3.5" strokeWidth={2} />
            Quay lại
          </Button>
        ) : null}
        <h1 className="font-headline-lg text-headline-lg text-on-surface">{title}</h1>
        {description ? (
          <p className="mt-1 font-body-md text-body-md text-on-surface-variant">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex items-center gap-stack-sm">{action}</div> : null}
    </div>
  );
}
