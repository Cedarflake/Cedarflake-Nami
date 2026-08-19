/**
 * @file favicon-serve.ts
 * @description
 * [EN] Embedded favicon resource handler.
 * Decodes and serves the embedded Base64 favicon directly from memory.
 *
 * [CN] 嵌入式图标资源处理程序。
 * 直接从内存解码并提供嵌入的 Base64 图标（Favicon）。
 *
 * @see {@link https://github.com/Cedarflake/Cedarflake-Nami} for repository info.
 */

import { base64Icon } from "@/assets/favicon"; 

export function serveFavicon(): Response {
  if (!base64Icon) {
    return new Response(null, { status: 204 });
  }

  try {
    const cleanBase64 = base64Icon.includes(",") ? base64Icon.split(",")[1] : base64Icon;
    const binaryString = atob(cleanBase64.trim());
    const length = binaryString.length;
    const bytes = new Uint8Array(length);

    for (let index = 0; index < length; index += 1) {
      bytes[index] = binaryString.charCodeAt(index);
    }

    return new Response(bytes.buffer, {
      headers: {
        "Content-Type": "image/x-icon",
        "Cache-Control": "public, max-age=86400"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(`Icon Error: ${message}`, { status: 500 });
  }
}
