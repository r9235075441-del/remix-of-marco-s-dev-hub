// Lovable's build pipeline expects a `dist/` directory after the build.
// Next.js emits `.next/`, so mirror it (minus the cache) into `dist/`.
const fs = require("fs");
const path = require("path");

const src = path.join(process.cwd(), ".next");
const dest = path.join(process.cwd(), "dist");

if (!fs.existsSync(src)) {
  console.error("No .next directory found — skipping dist mirror.");
  process.exit(0);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, {
  recursive: true,
  filter: (p) => !p.split(path.sep).includes("cache"),
});

const indexPath = path.join(dest, "index.html");
if (!fs.existsSync(indexPath)) {
  fs.writeFileSync(
    indexPath,
    "<!doctype html><meta charset=\"utf-8\"><title>PW-MARCO</title><p>Next.js server build output. Deploy on Vercel.</p>\n"
  );
}

console.log("Mirrored .next -> dist");
