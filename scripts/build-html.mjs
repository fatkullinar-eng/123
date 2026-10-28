import { build } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const root = path.resolve(import.meta.dirname, "..");
const temp = path.join(root, "dist-html");
await build({
  root,
  configFile: false,
  mode: "standalone",
  plugins: [react()],
  base: "./",
  build: {
    outDir: temp,
    target: "es2022",
    modulePreload: false,
    cssCodeSplit: false,
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    rollupOptions: {
      output: {
        format: "iife",
        inlineDynamicImports: true,
        entryFileNames: "application.js",
        assetFileNames: "[name][extname]",
      },
    },
  },
});

let html = await fs.readFile(path.join(temp, "index.html"), "utf8");
const javascript = (
  await fs.readFile(path.join(temp, "application.js"), "utf8")
).replace(/<\/script/gi, "<\\/script");
const css = (await fs.readFile(path.join(temp, "style.css"), "utf8")).replace(
  /<\/style/gi,
  "<\\/style",
);
const digest = crypto.createHash("sha256").update(javascript).digest("base64");
const policy = `default-src 'none'; script-src 'sha256-${digest}'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`;
html = html.replace(
  /<meta\s+http-equiv="Content-Security-Policy"\s+content="[^"]*"\s*\/?>/i,
  () => `<meta http-equiv="Content-Security-Policy" content="${policy}" />`,
);
html = html.replace(
  /<link[^>]+rel="stylesheet"[^>]*>/g,
  () => `<style>${css}</style>`,
);
// The classic inline script runs after #root exists and needs no file:// module requests.
html = html.replace(
  /\s*<script[^>]+src="[^"]*application\.js"[^>]*><\/script>/,
  "",
);
html = html.replace("</body>", () => `<script>${javascript}</script>\n</body>`);
if (/\b(?:src|href)="\.\//.test(html) || /<script[^>]+src=/.test(html)) {
  throw new Error("Standalone build still contains an external resource.");
}
if (!html.includes(`sha256-${digest}`) || !html.includes("<style>")) {
  throw new Error("Standalone styles or CSP hash were not generated.");
}
const output = path.join(root, "Bar-Estimate.html");
await fs.writeFile(output, html);
console.log(`Standalone HTML: ${output} (${Buffer.byteLength(html)} bytes)`);
