/**
 * @file font-serve.ts
 * @description
 * [EN] Embedded font resource handler for Runtime-owned branded pages.
 * Serves the same Inter Latin subset used by the WebUI without an external font request.
 *
 * [CN] Runtime 自有品牌页面的嵌入字体资源处理程序。
 * 在不依赖外部字体请求的情况下，提供与 WebUI 相同的 Inter Latin 子集。
 *
 * @see {@link https://github.com/Cedarflake/Cedarflake-Nami} for repository info.
 */

import {
  interLatinVariableFont,
  interLatinVariableFontPath
} from "@/assets/inter-font";

export { interLatinVariableFontPath };

export function serveInterFont(): Response {
  try {
    const cleanBase64 = interLatinVariableFont.includes(",")
      ? interLatinVariableFont.split(",")[1]
      : interLatinVariableFont;
    const binaryString = atob(cleanBase64.trim());
    const bytes = new Uint8Array(binaryString.length);

    for (let index = 0; index < binaryString.length; index += 1) {
      bytes[index] = binaryString.charCodeAt(index);
    }

    return new Response(bytes.buffer, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": "font/woff2",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(`Font Error: ${message}`, {
      status: 500,
      headers: { "Cache-Control": "no-store" }
    });
  }
}
