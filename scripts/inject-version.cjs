#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Inject build version into service worker, manifest, and generated metadata.
 * Version format: <packageVersion>-<YYYYMMDD>-<shortSha?> (sha optional).
 */

const fs = require('fs');
const path = require('path');

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function computeVersion() {
  const pkg = readJson(path.join(__dirname, '..', 'package.json'));
  const pkgVersion = pkg.version || '0.0.0';
  const date = new Date();
  const yyyymmdd = date.toISOString().slice(0, 10).replace(/-/g, '');
  const shortSha = (process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT || '').slice(0, 7);
  const parts = [pkgVersion, yyyymmdd];
  if (shortSha) parts.push(shortSha);
  return parts.join('-');
}

function updateServiceWorker(appVersion) {
  const swPath = path.join(__dirname, '..', 'public', 'service-worker.js');
  const swContent = fs.readFileSync(swPath, 'utf8');
  const replaced = swContent.replace(/const APP_VERSION = ['"][^'"]+['"];/, `const APP_VERSION = '${appVersion}';`);
  fs.writeFileSync(swPath, replaced);
}

function updateManifest(appVersion) {
  const manifestPath = path.join(__dirname, '..', 'public', 'manifest.json');
  const manifest = readJson(manifestPath);
  manifest.version = appVersion;
  writeJson(manifestPath, manifest);
}

function writeGeneratedVersion(appVersion) {
  const outDir = path.join(__dirname, '..', 'configs', 'generated');
  ensureDir(outDir);
  const outPath = path.join(outDir, 'version.json');
  writeJson(outPath, { version: appVersion });
  const publicVersionPath = path.join(__dirname, '..', 'public', 'app-version.json');
  writeJson(publicVersionPath, { version: appVersion });
}

(function run() {
  const appVersion = computeVersion();
  updateServiceWorker(appVersion);
  updateManifest(appVersion);
  writeGeneratedVersion(appVersion);
  console.log(`[inject-version] version set to ${appVersion}`);
})();
