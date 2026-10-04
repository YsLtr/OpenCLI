const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

if (!fs.existsSync(path.join(process.cwd(), 'src'))) {
  process.exit(0);
}

const npmExecPath = process.env.npm_execpath;
// npm, pnpm, and Yarn expose a JavaScript CLI entry here, which Node can run
// directly. Bun exposes its native executable instead; passing that binary to
// Node would make `bun install` fail during prepare, so use npm for non-JS
// runners (the build scripts themselves already invoke npm).
const hasJsExecPath = npmExecPath && /\.(?:c|m)?js$/i.test(npmExecPath);
const command = hasJsExecPath ? process.execPath : (process.platform === 'win32' ? 'npm.cmd' : 'npm');
const runNpm = (npmArgs) => {
  const args = hasJsExecPath ? [npmExecPath, ...npmArgs] : npmArgs;
  return spawnSync(command, args, {
    stdio: 'inherit',
    shell: !hasJsExecPath && process.platform === 'win32',
  });
};

// npm does not install a git dependency's devDependencies before running
// `prepare`, so installing this repository straight from a git URL leaves the
// TypeScript toolchain that `npm run build` needs missing. Install it first;
// `--ignore-scripts` keeps that install from re-entering this prepare hook.
const tscBin = process.platform === 'win32' ? 'tsc.cmd' : 'tsc';
if (!fs.existsSync(path.join(process.cwd(), 'node_modules', '.bin', tscBin))) {
  const install = runNpm(['install', '--include=dev', '--ignore-scripts', '--no-audit', '--no-fund']);
  if (install.error) {
    console.error(install.error.message);
    process.exit(1);
  }
  if (install.status !== 0) {
    process.exit(install.status ?? 1);
  }
}

const result = runNpm(['run', 'build']);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
