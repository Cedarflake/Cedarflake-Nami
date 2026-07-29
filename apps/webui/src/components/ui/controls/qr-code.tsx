'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { QRCodeCanvas } from "qrcode.react";
import { useTranslations } from 'next-intl';
import Image from "next/image";

import { Button } from "@/components/ui/controls/button";
import { AppDialog } from "@/components/ui/feedback/app-dialog";
import { useRuntimeSettings } from "@/components/redirects-groups/runtime-settings-context";

interface PopoverPosition {
  left: number;
  maxHeight: number;
  placement: "above" | "below";
  top: number;
}

const popoverGap = 8;
const viewportMargin = 12;
const mobileViewportQuery = "(max-width: 639px)";

function subscribeToMobileViewport(callback: () => void) {
  const mediaQuery = window.matchMedia(mobileViewportQuery);
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
}

function getMobileViewportSnapshot() {
  return window.matchMedia(mobileViewportQuery).matches;
}

function getServerMobileViewportSnapshot() {
  return false;
}

export function QRCodeButton({ pathKey, domain }: { pathKey: string; domain?: string; }) {
  const t = useTranslations('qrCode');
  const tCommon = useTranslations("common");
  const { canonicalOrigin } = useRuntimeSettings();
  const dialogTitleId = useId();
  const isMobileViewport = useSyncExternalStore(
    subscribeToMobileViewport,
    getMobileViewportSnapshot,
    getServerMobileViewportSnapshot,
  );
  const [open, setOpen] = useState(false);
  const [showIcon, setShowIcon] = useState(true);
  const [popoverPosition, setPopoverPosition] = useState<PopoverPosition | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const qrWrapperRef = useRef<HTMLDivElement | null>(null);

  const baseUrl = domain || canonicalOrigin;
  const cleanPath = pathKey.startsWith('/') ? pathKey : `/${pathKey}`;
  const finalUrl = `${baseUrl}${cleanPath}`;

  const closePopover = useCallback(() => {
    setOpen(false);
    setPopoverPosition(null);
  }, []);

  const toggleOpen = () => {
    if (open) {
      closePopover();
      return;
    }
    setPopoverPosition(null);
    setOpen(true);
  };

  const downloadQRCode = () => {
    if (!qrWrapperRef.current) return;
    
    const sourceCanvas = qrWrapperRef.current.querySelector('canvas');
    if (!sourceCanvas) return;

    const canvas = document.createElement('canvas');
    canvas.width = sourceCanvas.width;
    canvas.height = sourceCanvas.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(sourceCanvas, 0, 0);

    if (showIcon) {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.src = "/favicon.ico";
      
      img.onload = () => {
        const size = sourceCanvas.width;
        const iconSize = 32 * (size / 160);
        const bgSize = iconSize + 4;
        const center = size / 2;

        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        const x = center - bgSize / 2;
        const y = center - bgSize / 2;
        const r = 4;
        ctx.roundRect(x, y, bgSize, bgSize, r);
        ctx.fill();

        ctx.drawImage(img, center - iconSize / 2, center - iconSize / 2, iconSize, iconSize);
        saveCanvas(canvas);
      };
      
      img.onerror = () => saveCanvas(canvas);
    } else {
      saveCanvas(canvas);
    }
  };

  const saveCanvas = (canvas: HTMLCanvasElement) => {
    const safeName = pathKey.replace(/^\/+/, '').replace(/\//g, '-') || 'home';
    
    const link = document.createElement('a');
    link.download = `qrcode-${safeName}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const updatePopoverPosition = useCallback(() => {
    const trigger = rootRef.current;
    const popover = popoverRef.current;
    if (!trigger || !popover) {
      return;
    }

    const triggerRect = trigger.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();
    const maxHeight = Math.max(0, window.innerHeight - viewportMargin * 2);
    const renderedHeight = Math.min(popoverRect.height, maxHeight);
    const renderedWidth = Math.min(
      popoverRect.width,
      Math.max(0, window.innerWidth - viewportMargin * 2),
    );
    const spaceAbove = triggerRect.top - popoverGap - viewportMargin;
    const spaceBelow = window.innerHeight
      - triggerRect.bottom
      - popoverGap
      - viewportMargin;
    const placement = spaceBelow >= renderedHeight || spaceBelow >= spaceAbove
      ? "below"
      : "above";
    const desiredTop = placement === "below"
      ? triggerRect.bottom + popoverGap
      : triggerRect.top - popoverGap - renderedHeight;
    const maximumTop = Math.max(
      viewportMargin,
      window.innerHeight - viewportMargin - renderedHeight,
    );
    const maximumLeft = Math.max(
      viewportMargin,
      window.innerWidth - viewportMargin - renderedWidth,
    );
    const nextPosition: PopoverPosition = {
      left: Math.round(Math.min(
        Math.max(triggerRect.right - renderedWidth, viewportMargin),
        maximumLeft,
      )),
      maxHeight: Math.round(maxHeight),
      placement,
      top: Math.round(Math.min(
        Math.max(desiredTop, viewportMargin),
        maximumTop,
      )),
    };

    setPopoverPosition((previous) => (
      previous
      && previous.left === nextPosition.left
      && previous.maxHeight === nextPosition.maxHeight
      && previous.placement === nextPosition.placement
      && previous.top === nextPosition.top
        ? previous
        : nextPosition
    ));
  }, []);

  useEffect(() => {
    if (!open || isMobileViewport) return;
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (rootRef.current?.contains(target) || popoverRef.current?.contains(target)) {
        return;
      }
      closePopover();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePopover();
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [closePopover, isMobileViewport, open]);

  useEffect(() => {
    if (!open || isMobileViewport) {
      return;
    }

    const animationFrame = window.requestAnimationFrame(updatePopoverPosition);
    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(updatePopoverPosition);
    if (popoverRef.current) {
      resizeObserver?.observe(popoverRef.current);
    }
    window.addEventListener("resize", updatePopoverPosition);
    window.addEventListener("scroll", updatePopoverPosition, true);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updatePopoverPosition);
      window.removeEventListener("scroll", updatePopoverPosition, true);
    };
  }, [isMobileViewport, open, updatePopoverPosition]);

  if (!pathKey) return null;

  const popoverStyle: CSSProperties = popoverPosition
    ? {
        left: popoverPosition.left,
        maxHeight: popoverPosition.maxHeight,
        top: popoverPosition.top,
      }
    : {
        left: viewportMargin,
        top: viewportMargin,
        visibility: "hidden",
      };

  const qrCodePreview = (
    <>
      <div className="rounded-2xl border border-line bg-panel p-2">
        <div ref={qrWrapperRef} className="relative flex items-center justify-center">
          <QRCodeCanvas
            value={finalUrl}
            size={160}
            level={"H"}
            marginSize={0}
          />
          {showIcon && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <Image
                src="/favicon.ico"
                alt={t('faviconAlt')}
                width={32}
                height={32}
                className="rounded-lg border-2 border-white bg-white shadow-sm"
                unoptimized
              />
            </div>
          )}
        </div>
      </div>

      <div className="w-full space-y-4">
        <p className="truncate px-2 text-center font-mono text-[10px] text-muted" title={finalUrl}>
          {finalUrl}
        </p>
        <div className="h-px w-full bg-line" />

        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-medium text-muted">{t('faviconLabel')}</span>
          <button
            type="button"
            onClick={() => setShowIcon(!showIcon)}
            aria-pressed={showIcon}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out focus:outline-none ${
              showIcon ? 'bg-accent' : 'bg-line-strong'
            }`}
          >
            <span
              aria-hidden="true"
              className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white ring-0 transition-all duration-200 ease-in-out ${
                showIcon ? 'ml-auto' : 'ml-0'
              }`}
            />
          </button>
        </div>
      </div>
    </>
  );

  const downloadButton = (
    <Button
      onClick={downloadQRCode}
      className="w-full"
      size="sm"
      variant="secondary"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>
      </svg>
      {t('download') || "Save Image"}
    </Button>
  );

  const qrCodeContent = (
    <div className="flex flex-col items-center gap-4">
      {qrCodePreview}
      {downloadButton}
    </div>
  );

  return (
    <div ref={rootRef} className="relative inline-flex shrink-0">
      <Button
        onClick={toggleOpen}
        title={t('openQRCode')}
        aria-label={t('openQRCode')}
        aria-expanded={open}
        aria-haspopup="dialog"
        size="icon"
        variant={open ? "primary" : "secondary"}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/><path d="M14 9v6"/><path d="M9 15h6"/>
        </svg>
      </Button>

      {open && isMobileViewport ? (
        <AppDialog
          ariaLabelledBy={dialogTitleId}
          isOpen
          onClose={closePopover}
          widthClassName="max-w-xs"
        >
          <div className="p-0">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line bg-panel px-4 py-3">
              <h2 id={dialogTitleId} className="text-base font-semibold text-ink">
                {t("openQRCode")}
              </h2>
              <Button
                onClick={closePopover}
                size="icon"
                variant="ghost"
                title={tCommon("close")}
                aria-label={tCommon("close")}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-4 w-4"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path
                    d="M6 6l12 12M18 6 6 18"
                    strokeLinecap="round"
                  />
                </svg>
              </Button>
            </div>
            <div className="flex flex-col items-center gap-4 px-4 py-4">
              {qrCodePreview}
            </div>
            <div className="sticky bottom-0 z-10 border-t border-line bg-panel p-4">
              {downloadButton}
            </div>
          </div>
        </AppDialog>
      ) : open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popoverRef}
              role="dialog"
              aria-label={t('openQRCode')}
              style={popoverStyle}
              className={`fixed z-50 w-56 max-w-[calc(100vw-1.5rem)] overflow-y-auto overscroll-contain rounded-2xl border border-line bg-panel p-4 shadow-[0_24px_60px_-32px_rgb(23_32_51_/_55%)] ${
                popoverPosition?.placement === "above"
                  ? "origin-bottom-right animate-[fade-up_200ms_ease-out]"
                  : "origin-top-right animate-[fade-up_200ms_ease-out]"
              }`}
            >
              {qrCodeContent}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
