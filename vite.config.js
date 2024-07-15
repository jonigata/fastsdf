import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'FastSDF',
      fileName: (format) => `fastsdf.${format}.js`
    },
    rollupOptions: {
      external: [], // 外部依存関係がある場合に追加
      output: {
        globals: {
          // 外部依存関係がある場合に追加
        }
      }
    }
  },
  server: {
    open: '/examples/index.html'
  }  
});
