type FormControlSize = "sm" | "md" | "textarea";

interface FormControlClassNameOptions {
  className?: string;
  size?: FormControlSize;
}

const sizeClassNames: Record<FormControlSize, string> = {
  sm: "h-9 rounded-lg px-3 text-sm",
  md: "h-10 rounded-xl px-3.5 text-sm",
  textarea: "min-h-24 rounded-xl px-3.5 py-2.5 text-sm",
};

export const fieldLabelClassName = "text-xs font-semibold uppercase tracking-[0.12em] text-muted";
export const fieldLabelRowClassName = "mb-1.5 flex h-6 items-center gap-1.5";

export function formControlClassName({
  className,
  size = "md",
}: FormControlClassNameOptions = {}): string {
  return [
    "min-w-0 border border-line bg-panel text-ink outline-none transition",
    "placeholder:text-muted hover:border-line-strong focus:border-accent focus:ring-3 focus:ring-accent-soft",
    "disabled:cursor-not-allowed disabled:bg-panel-muted disabled:text-muted disabled:opacity-70",
    sizeClassNames[size],
    className,
  ]
    .filter(Boolean)
    .join(" ");
}
