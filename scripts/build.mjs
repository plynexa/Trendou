import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// Compatibility output for the existing Vercel project rooted at the repository.
const root = fileURLToPath(new URL('../', import.meta.url));
const source = join(root, 'sites', 'air-fryer');
const target = join(root, 'public', 'air-fryer');
await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
for (const item of ['index.html', 'styles.css', 'script.js', 'analytics.js', 'privacidade.html', 'admin', 'assets']) {
  await cp(join(source, item), join(target, item), { recursive: true });
}
console.log('Air Fryer ready in public/air-fryer');
