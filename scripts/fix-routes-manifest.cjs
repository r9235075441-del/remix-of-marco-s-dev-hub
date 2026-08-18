const fs = require("fs");
const path = require("path");

const manifestPath = path.join(process.cwd(), ".next", "routes-manifest.json");

if (!fs.existsSync(manifestPath)) {
  process.exit(0);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

if (!Array.isArray(manifest.dataRoutes)) {
  manifest.dataRoutes = [];
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`);
  console.log("Patched .next/routes-manifest.json with empty dataRoutes.");
}
