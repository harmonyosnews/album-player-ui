import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const APLAYER = process.env.APLAYER_URL || 'http://127.0.0.1:7778';

export default defineConfig({
  base: '/',
  define: { __APUI_VERSION__: JSON.stringify(pkg.version) },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/ap': {
        target: APLAYER,
        changeOrigin: false,
        rewrite: (p) => p.replace(/^\/ap/, ''),
      },
    },
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: false,
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        entryFileNames: 'ui/app-[hash].js',
        chunkFileNames: 'ui/chunk-[hash].js',
        assetFileNames: (info) => {
          const name = info.names?.[0] || info.name || '';
          if (name.endsWith('.css')) return 'ui/app-[hash][extname]';
          return 'ui/[name]-[hash][extname]';
        },
      },
    },
  },
});
