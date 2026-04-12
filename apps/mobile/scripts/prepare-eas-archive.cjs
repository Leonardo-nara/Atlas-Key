const fs = require("node:fs");
const path = require("node:path");

if (process.platform !== "win32") {
  process.exit(0);
}

const repoRoot = path.resolve(__dirname, "..", "..", "..");
const rootDirectories = [
  repoRoot,
  path.join(repoRoot, "apps"),
  path.join(repoRoot, "packages"),
];

const recursiveDirectories = [
  path.join(repoRoot, "apps", "mobile"),
  path.join(repoRoot, "packages", "shared-types"),
];

const ignoredDirectories = new Set([
  ".expo",
  ".turbo",
  ".cache",
  "build",
  "coverage",
  "dist",
  "dist-electron",
  "node_modules",
  "release",
]);

function chmodWritable(target, recursive = true) {
  if (!fs.existsSync(target)) {
    return;
  }

  const stat = fs.statSync(target);
  fs.chmodSync(target, stat.isDirectory() ? 0o777 : 0o666);

  if (!recursive || !stat.isDirectory()) {
    return;
  }

  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
      continue;
    }

    chmodWritable(path.join(target, entry.name));
  }
}

for (const target of rootDirectories) {
  chmodWritable(target, false);
}

for (const target of recursiveDirectories) {
  chmodWritable(target);
}
