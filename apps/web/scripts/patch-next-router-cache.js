const fs = require("node:fs");
const path = require("node:path");

const webRoot = path.resolve(__dirname, "..");
const nextPackageJson = require.resolve("next/package.json", {
  paths: [webRoot],
});
const nextRoot = path.dirname(nextPackageJson);
const appRenderPath = path.join(
  nextRoot,
  "dist",
  "server",
  "app-render",
  "app-render.js",
);

if (!fs.existsSync(appRenderPath)) {
  throw new Error("Next.js app renderer not found at " + appRenderPath);
}

const source = fs.readFileSync(appRenderPath, "utf8");
const nullInitialRoutes = /initialParallelRoutes\s*:\s*null\s*,/g;
const matches = source.match(nullInitialRoutes) || [];

if (matches.length < 2) {
  throw new Error(
    "Expected at least 2 Next.js initialParallelRoutes null values, found " +
      matches.length +
      ". Refusing to build without the App Router fix.",
  );
}

const patched = source.replace(
  nullInitialRoutes,
  "initialParallelRoutes: new Map(),",
);
fs.writeFileSync(appRenderPath, patched, "utf8");
console.log(
  "Applied Next.js App Router cache initialization fix (" +
    matches.length +
    " call sites).",
);
