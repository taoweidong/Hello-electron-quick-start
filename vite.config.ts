import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [vue()],
  base: './',
  root: resolve(__dirname, './src/view'),
  publicDir: resolve(__dirname, './src/view/public'),
  build: {
    outDir: resolve(__dirname, './dist/view'),
    emptyOutDir: true,
    rollupOptions: {
      external: []
    }
  },
  server: {
    port: 5180,  // 更改端口为5180
    strictPort: true
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src/view/src'),
      '@shared': resolve(__dirname, './src/shared')
    }
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use "@/styles/variables.scss" as *;`
      }
    }
  }
})