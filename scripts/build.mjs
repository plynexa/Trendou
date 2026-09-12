import { cp, mkdir, rm, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const publicDir = join(root, 'public');
const home = join(root, 'sites', 'vitrine');
const airFryer = join(root, 'sites', 'air-fryer');

await rm(publicDir, { recursive: true, force: true });
await mkdir(publicDir, { recursive: true });

// Trendou Home: catálogo, páginas automáticas e checkout.
for (const item of ['index.html','styles.css','theme-feminino.css','app.js','produto.html','produto.js','checkout']) {
  await cp(join(home, item), join(publicDir, item), { recursive: true });
}
// Admin central em caminho físico próprio. /admin fica livre para os rewrites por domínio.
await cp(join(home, 'admin'), join(publicDir, 'trendou-admin'), { recursive: true });

// Mantém / sem um arquivo físico para que o rewrite por hostname possa escolher
// Trendou Home ou Air Fryer sem alterar o endereço exibido no navegador.
await mkdir(join(publicDir, 'home'), { recursive: true });
await rename(join(publicDir, 'index.html'), join(publicDir, 'home', 'index.html'));

// Air Fryer continua disponível no mesmo repositório e no domínio dedicado.
const airTarget = join(publicDir, 'air-fryer');
await mkdir(airTarget, { recursive: true });
for (const item of ['index.html', 'styles.css', 'script.js', 'analytics.js', 'privacidade.html', 'admin', 'assets']) {
  await cp(join(airFryer, item), join(airTarget, item), { recursive: true });
}

console.log('Trendou Home ready in public/ and Air Fryer ready in public/air-fryer');
