#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function main() {
  const extensionDir = path.resolve(__dirname, '..');
  const rootDir = path.resolve(extensionDir, '..');
  const manifestPath = path.join(extensionDir, 'src/manifest.json');
  const distDir = path.join(extensionDir, 'dist');

  const rootPkg = readJson(path.join(rootDir, 'package.json'));
  const manifest = readJson(manifestPath);

  manifest.version = rootPkg.version;
  writeJson(manifestPath, manifest);

  execSync('pnpm run build', {
    cwd: extensionDir,
    stdio: 'inherit'
  });

  const zipName = `magpie-extension-${rootPkg.version}.zip`;
  const zipOutputPath = path.join(extensionDir, zipName);

  if (fs.existsSync(zipOutputPath)) {
    fs.rmSync(zipOutputPath);
  }

  const relativeZipTarget = path
    .relative(distDir, zipOutputPath)
    .replace(/\\/g, '/');

  execSync(`zip -qr ${JSON.stringify(relativeZipTarget)} .`, {
    cwd: distDir,
    stdio: 'inherit'
  });

  const updatedManifest = readJson(manifestPath);
  console.log('Extension name:', updatedManifest.name);
  console.log('Extension description:', updatedManifest.description);
  console.log('Created archive:', path.relative(extensionDir, zipOutputPath) || path.basename(zipOutputPath));
}

main();
