"use client";

import {
  useEffect,
  useRef,
  type ReactNode,
} from "react";

interface AppDialogProps {
  ariaLabelledBy?: string;
  children: ReactNode;
  className?: string;
  isOpen: boolean;
  onClose: () => void;
  preventClose?: boolean;
  widthClassName?: string;
}

export function AppDialog({
  ariaLabelledBy,
  children,
  className,
  isOpen,
  onClose,
  preventClose = false,
  widthClassName = "max-w-md",
}: AppDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={ariaLabelledBy}
      onCancel={(event) => {
        event.preventDefault();
        if (!preventClose) {
          onClose();
        }
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !preventClose) {
          onClose();
        }
      }}
      className={[
        "m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%_-_2rem)] overflow-hidden rounded-2xl border border-line bg-panel p-0 text-ink backdrop:bg-ink/30 backdrop:backdrop-blur-[2px]",
        widthClassName,
        className,
      ].filter(Boolean).join(" ")}
    >
      <div className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain">
        {children}
      </div>
    </dialog>
  );
}
