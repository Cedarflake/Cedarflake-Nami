'use client';

import { useEffect, useRef, useState } from "react";

import { formControlClassName } from "@/components/ui/controls/form-control";

export type DropdownOption = { value: string; label: string };

export function DropdownSelect({
  value,
  options,
  onChange,
  className,
  disabled = false,
}: {
  value: string;
  options: DropdownOption[];
  onChange: (next: string) => void;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current && !rootRef.current.contains(target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={"relative " + (className ?? "")}>
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        disabled={disabled}
        className={formControlClassName({
          className: "relative w-full pl-3.5 pr-10 text-left disabled:cursor-default disabled:bg-panel-muted disabled:text-muted",
        })}
        aria-haspopup="listbox"
        aria-expanded={open && !disabled}
      >
        {selected?.label ?? value}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && !disabled ? (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-line bg-panel shadow-[0_18px_40px_-24px_rgb(23_32_51_/_45%)]">
          <div className="max-h-60 overflow-auto py-1">
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={
                    "w-full px-3 py-2 text-left text-sm transition focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent " +
                    (isSelected
                      ? "bg-accent-soft font-semibold text-accent-strong"
                      : "text-ink hover:bg-panel-muted")
                  }
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
