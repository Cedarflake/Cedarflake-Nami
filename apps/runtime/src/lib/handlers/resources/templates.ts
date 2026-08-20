/**
 * @file templates.ts
 * @description
 * [EN] Runtime-owned self-contained 404 resource shared by every adapter.
 *
 * [CN] 所有 Runtime 适配器共用的自包含 404 资源。
 *
 * @see {@link https://github.com/Cedarflake/Cedarflake-Nami} for repository info.
 */

import { interLatinVariableFontPath } from "@/assets/inter-font";

export const notFoundPageHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <meta name="theme-color" content="#722ef1">
    <link rel="icon" href="/favicon.ico?v=nami-2" type="image/x-icon">
    <title>404 · Page not found</title>
    <style>
      @font-face {
        font-family: "Inter";
        font-style: normal;
        font-weight: 100 900;
        font-display: swap;
        src: url("${interLatinVariableFontPath}") format("woff2");
      }

      :root {
        color-scheme: light;
        --canvas: #ffffff;
        --panel: #ffffff;
        --ink: #172033;
        --muted: #667085;
        --line: #e1e5eb;
        --accent: #722ef1;
        --accent-strong: #5520c2;
        font-family: "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      * {
        box-sizing: border-box;
      }

      html {
        background: var(--canvas);
      }

      body {
        min-height: 100vh;
        min-height: 100dvh;
        margin: 0;
        background: var(--canvas);
        color: var(--ink);
      }

      .page {
        display: flex;
        min-height: 100vh;
        min-height: 100dvh;
        align-items: center;
        justify-content: center;
        padding: 2rem 1.5rem;
      }

      .panel-shell {
        width: 100%;
        max-width: 28rem;
      }

      .panel {
        padding: 2rem;
        border: 1px solid var(--line);
        border-radius: 1rem;
        background: var(--panel);
        animation: panel-in 420ms cubic-bezier(0.16, 1, 0.3, 1);
      }

      .brand-row {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        gap: 1rem;
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        color: var(--muted);
        font-size: 0.75rem;
        font-weight: 600;
        letter-spacing: 0.4em;
        text-transform: uppercase;
      }

      .brand-mark {
        width: 2rem;
        height: 0.25rem;
        border-radius: 9999px;
        background: var(--accent);
      }

      .home-link svg {
        width: 1rem;
        height: 1rem;
      }

      h1 {
        margin: 1.5rem 0 0;
        color: var(--ink);
        font-size: 1.875rem;
        font-weight: 600;
        line-height: 2.25rem;
      }

      p {
        margin: 0.75rem 0 0;
        color: var(--muted);
        font-size: 0.875rem;
        line-height: 1.5rem;
      }

      .home-link {
        display: inline-flex;
        width: 100%;
        height: 2.5rem;
        margin-top: 2rem;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        border: 1px solid var(--accent);
        border-radius: 0.75rem;
        background: var(--accent);
        color: #ffffff;
        font-size: 0.875rem;
        font-weight: 600;
        text-decoration: none;
        transition: background-color 150ms ease, border-color 150ms ease;
        -webkit-tap-highlight-color: transparent;
      }

      .home-link:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }

      @media (hover: hover) {
        .home-link:hover {
          border-color: var(--accent-strong);
          background: var(--accent-strong);
        }
      }

      @media (max-width: 639px) {
        .panel {
          padding: 1.5rem;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .panel {
          animation: none;
        }

        .home-link {
          transition: none;
        }
      }

      @keyframes panel-in {
        0% {
          opacity: 0;
          transform: translateY(14px) scale(0.985);
          filter: blur(10px);
        }
        60%,
        100% {
          opacity: 1;
          transform: translateY(0) scale(1);
          filter: blur(0);
        }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <div class="panel-shell">
        <section class="panel" aria-labelledby="not-found-title">
          <div class="brand-row">
            <div class="brand">
              <span class="brand-mark" aria-hidden="true"></span>
              Nami
            </div>
          </div>

          <h1 id="not-found-title">404 · Page not found</h1>
          <p>The page you requested does not exist or may have moved.</p>

          <a class="home-link" href="/">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <path d="M9 22V12h6v10"></path>
            </svg>
            Return home
          </a>
        </section>
      </div>
    </main>
  </body>
</html>
`;
