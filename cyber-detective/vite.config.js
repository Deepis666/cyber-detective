import { defineConfig } from 'vite';
import { execSync } from 'child_process';

export default defineConfig({
  root: '.',
  publicDir: 'assets',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true
  },
  server: {
    port: 3000,
    open: true
  },
  plugins: [
    {
      name: 'copy-extra',
      closeBundle() {
        execSync('xcopy data dist\\data /E /I /Q', { stdio: 'inherit' });
        execSync('xcopy prompts dist\\prompts /E /I /Q', { stdio: 'inherit' });
        console.log('✅ data/ 和 prompts/ 已复制到 dist/');
      }
    }
  ]
});
