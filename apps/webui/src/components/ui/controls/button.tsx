import type { ComponentPropsWithRef } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "icon-xs" | "icon-sm" | "icon" | "icon-lg";

interface ButtonClassNameOptions {
  className?: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
}

export type ButtonProps = ComponentPropsWithRef<"button"> & {
  isPending?: boolean;
  pendingLabel?: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

const baseClassName =
  "relative inline-flex items-center justify-center gap-2 font-semibold transition " +
  "disabled:pointer-events-none disabled:opacity-45 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const variantClassNames: Record<ButtonVariant, string> = {
  primary: "border border-accent bg-accent text-white hover:border-accent-strong hover:bg-accent-strong",
  secondary: "border border-line bg-panel text-ink hover:border-line-strong hover:bg-panel-muted",
  ghost: "border border-transparent bg-transparent text-muted hover:bg-panel-muted hover:text-ink",
  danger: "border border-danger/25 bg-panel text-danger hover:bg-danger/5",
};

const sizeClassNames: Record<ButtonSize, string> = {
  sm: "h-8 rounded-lg px-3 text-xs",
  md: "h-10 rounded-xl px-4 text-sm",
  "icon-xs": "h-6 w-6 rounded-md",
  "icon-sm": "h-7 w-7 rounded-lg",
  icon: "h-9 w-9 rounded-lg",
  "icon-lg": "h-10 w-10 rounded-xl",
};

export function buttonClassName({
  className,
  size = "md",
  variant = "secondary",
}: ButtonClassNameOptions = {}): string {
  return [baseClassName, variantClassNames[variant], sizeClassNames[size], className]
    .filter(Boolean)
    .join(" ");
}

export function Button({
  "aria-busy": ariaBusy,
  "aria-label": ariaLabel,
  children,
  className,
  disabled,
  isPending = false,
  pendingLabel,
  size = "md",
  type = "button",
  variant = "secondary",
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      aria-busy={isPending ? true : ariaBusy}
      aria-label={isPending && pendingLabel ? pendingLabel : ariaLabel}
      disabled={disabled || isPending}
      type={type}
      className={buttonClassName({ className, size, variant })}
    >
      <span
        className={[
          "inline-flex items-center justify-center gap-2 transition-opacity",
          isPending ? "opacity-0" : "opacity-100",
        ].join(" ")}
      >
        {children}
      </span>
      {isPending ? (
        <span
          aria-hidden="true"
          className="absolute h-3.5 w-3.5 rounded-full border-2 border-current border-r-transparent animate-spin motion-reduce:animate-none"
        />
      ) : null}
    </button>
  );
}
