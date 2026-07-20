import * as esbuild from 'esbuild';

async function build() {
  console.log('📦 Bundling and minifying server with esbuild...');

  await esbuild.build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'esm',
    outfile: 'dist/server.js',
    minify: true,
    sourcemap: false,
    external: [
      'better-sqlite3',
    ],
    banner: {
      js: `import { createRequire } from 'module'; const require = createRequire(import.meta.url);`,
    },
  });

  console.log('✅ Server built successfully: dist/server.js');
}

build().catch((err) => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
