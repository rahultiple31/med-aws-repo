const fs = require('node:fs/promises');
const path = require('node:path');

async function copyDir(src, dest) {
  const entries = await fs.readdir(src, { withFileTypes: true });
  await fs.mkdir(dest, { recursive: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
      continue;
    }

    if (entry.isFile()) {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function main() {
  const root = path.resolve(__dirname, '..');
  const srcDir = path.join(root, 'src');
  const distDir = path.join(root, 'dist');

  await fs.rm(distDir, { recursive: true, force: true });
  await copyDir(srcDir, distDir);

  console.log(`Build complete: ${distDir}`);
}

main().catch((err) => {
  console.error('Build failed', err);
  process.exit(1);
});
