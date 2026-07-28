import { getTargetFaviconUrl } from "@/composables/editor/route-utils";

interface TargetFaviconProps {
  target: string;
}

export function TargetFavicon({ target }: TargetFaviconProps) {
  const faviconUrl = getTargetFaviconUrl(target);

  return (
    <span className="relative flex h-[3.125rem] w-[3.125rem] shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-panel-muted text-muted">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="h-5 w-5"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.4 2.5 3.6 5.5 3.6 9S14.4 18.5 12 21c-2.4-2.5-3.6-5.5-3.6-9S9.6 5.5 12 3Z" />
      </svg>
      {faviconUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={faviconUrl}
          src={faviconUrl}
          alt=""
          className="absolute inset-0 h-full w-full bg-panel object-contain p-2.5"
          decoding="async"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
        />
      ) : null}
    </span>
  );
}
