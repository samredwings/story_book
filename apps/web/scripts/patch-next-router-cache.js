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
const nullInitialRoutes = /initialParallelRoutes\s*:\s*null\s*,?/g;
const matches = source.match(nullInitialRoutes) || [];

if (matches.length === 0) {
  const alreadyPatched =
    /initialParallelRoutes\s*:\s*new Map\(\)\s*,?/.test(source);

  if (alreadyPatched) {
    console.log("Next.js App Router cache fix is already applied.");
    process.exit(0);
  }

  throw new Error(
    "Could not find an unpatched initialParallelRoutes value in " +
      appRenderPath +
      ". The installed Next.js source may have changed; inspect this file before building.",
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
    " call site(s)).",
);