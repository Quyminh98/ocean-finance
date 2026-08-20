import { Label } from "@/components/ui/label";

type FieldProps = {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
};

/** Label + input + inline error, shared layout across employee/salary forms. */
export function Field({ label, htmlFor, error, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-stack-sm">
      <Label htmlFor={htmlFor} className="font-label-caps text-label-caps uppercase text-on-surface">
        {label}
      </Label>
      {children}
      {error ? <p className="font-body-md text-body-md text-error-red">{error}</p> : null}
    </div>
  );
}
