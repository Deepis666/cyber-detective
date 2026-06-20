import { defineConfig } from 'vite';
import { execSync } from 'child_process';
import { platform } from 'os';

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
        if (platform() === 'win32') {
          execSync('xcopy data dist\\data /E /I /Q', { stdio: 'inherit' });
          execSync('xcopy prompts dist\\prompts /E /I /Q', { stdio: 'inherit' });
        } else {
          execSync('cp -r data dist/data', { stdio: 'inherit' });
          execSync('cp -r prompts dist/prompts', { stdio: 'inherit' });
        }
        console.log('✅ data/ 和 prompts/ 已复制到 dist/');
      }
    }
  ]
});
