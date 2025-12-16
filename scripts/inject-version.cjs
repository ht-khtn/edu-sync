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
  // Source of truth: public/app-version.json (base), fallback to package.json version
  const pkg = readJson(path.join(__dirname, '..', 'package.json'));
  let baseVersion = pkg.version || '0.0.0';

  try {
    const appVersionPath = path.join(__dirname, '..', 'public', 'app-version.json');
    const av = readJson(appVersionPath);
    if (av && typeof av === 'object') {
      baseVersion = (av.base || av.version || baseVersion).toString();
    }
  } catch {
    // ignore missing app-version.json; fall back to package.json version
  }

  const shortSha = (process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT || '').slice(0, 7);
  const version = shortSha ? `${baseVersion}-${shortSha}` : baseVersion;
  return { baseVersion, version };
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

function writeGeneratedVersion(baseVersion, appVersion) {
  const outDir = path.join(__dirname, '..', 'configs', 'generated');
  ensureDir(outDir);
  const outPath = path.join(outDir, 'version.json');
  writeJson(outPath, { version: appVersion });
  const publicVersionPath = path.join(__dirname, '..', 'public', 'app-version.json');
  writeJson(publicVersionPath, { base: baseVersion, version: appVersion });
}

(function run() {
  const { baseVersion, version } = computeVersion();
  updateServiceWorker(version);
  updateManifest(version);
  writeGeneratedVersion(baseVersion, version);
  console.log(`[inject-version] version set to ${version} (base=${baseVersion})`);
})();
