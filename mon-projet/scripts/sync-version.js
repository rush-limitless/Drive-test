const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const rootPkgPath = path.join(repoRoot, 'package.json');
const rootLockPath = path.join(repoRoot, 'package-lock.json');
const stampPath = path.join(repoRoot, '.version-bump.json');

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const writeJson = (filePath, data) => {
  const contents = JSON.stringify(data, null, 2) + '\n';
  fs.writeFileSync(filePath, contents, 'utf8');
};

const parseSemver = (value) => {
  const match = /^([0-9]+)\.([0-9]+)\.([0-9]+)(?:[-+].*)?$/.exec(value);
  if (!match) {
    return null;
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
};

const bumpPatch = (value) => {
  const parts = parseSemver(value);
  if (!parts) {
    throw new Error(`Version '${value}' is not valid semver (expected X.Y.Z).`);
  }
  return `${parts.major}.${parts.minor}.${parts.patch + 1}`;
};

const shouldBump = String(process.env.MOBIQ_BUILD_BUMP || '').trim() === '1';
const buildId = String(process.env.MOBIQ_BUILD_ID || '').trim();

const rootPkg = readJson(rootPkgPath);
let version = String(rootPkg.version || '').trim();
if (!version) {
  throw new Error('Root package.json version is missing.');
}

if (shouldBump) {
  let lastStamp = null;
  if (fs.existsSync(stampPath)) {
    try {
      lastStamp = readJson(stampPath);
    } catch {
      lastStamp = null;
    }
  }
  const lastBuildId = lastStamp && typeof lastStamp.buildId === 'string' ? lastStamp.buildId : null;
  if (!buildId || buildId !== lastBuildId) {
    const nextVersion = bumpPatch(version);
    rootPkg.version = nextVersion;
    writeJson(rootPkgPath, rootPkg);

    if (fs.existsSync(rootLockPath)) {
      try {
        const rootLock = readJson(rootLockPath);
        rootLock.version = nextVersion;
        if (rootLock.packages && rootLock.packages['']) {
          rootLock.packages[''].version = nextVersion;
        }
        writeJson(rootLockPath, rootLock);
      } catch {
        // ignore lock update failures
      }
    }

    version = nextVersion;
    writeJson(stampPath, {
      buildId: buildId || new Date().toISOString(),
      version,
      bumpedAt: new Date().toISOString(),
    });
  }
}

const frontendPkgPath = path.join(repoRoot, 'src', 'frontend', 'package.json');
const electronPkgPath = path.join(repoRoot, 'src', 'electron', 'package.json');
const backendConfigPath = path.join(repoRoot, 'src', 'backend', 'core', 'config.py');
const frontendVersionPath = path.join(repoRoot, 'src', 'frontend', 'src', 'version.ts');

const frontendPkg = readJson(frontendPkgPath);
frontendPkg.version = version;
writeJson(frontendPkgPath, frontendPkg);

const electronPkg = readJson(electronPkgPath);
electronPkg.version = version;
electronPkg.description = `Mobile Test Automation Tool v${version}`;
writeJson(electronPkgPath, electronPkg);

const configRaw = fs.readFileSync(backendConfigPath, 'utf8');
const versionPattern = /APP_VERSION:\s*str\s*=\s*"[^"]*"/;
if (!versionPattern.test(configRaw)) {
  throw new Error('APP_VERSION not found in backend config.');
}
const updatedConfig = configRaw.replace(versionPattern, `APP_VERSION: str = "${version}"`);
fs.writeFileSync(backendConfigPath, updatedConfig, 'utf8');

const versionTs = `// Auto-generated. Do not edit manually.\nexport const APP_VERSION = '${version}';\n`;
fs.writeFileSync(frontendVersionPath, versionTs, 'utf8');

console.log(`Synchronized version to ${version}`);
