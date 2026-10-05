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
    // Electron 44 内核远高于此下限，取保守值避免过度转译（方案 B4/E6）
    target: 'chrome126',
    // 产 sourcemap 供崩溃定位，但 hidden 不注入 //# sourceMappingURL，浏览器/打包不携带
    sourcemap: 'hidden',
    rollupOptions: {
      output: {
        // element-plus 体积大且稳定，单独 vendor chunk 利于缓存与首屏（方案 B4/E6）。
        // 注意：rolldown 只支持函数形态的 manualChunks（对象形态直接报 TypeError）
        manualChunks(id: string) {
          if (id.includes('node_modules') && (id.includes('element-plus') || id.includes('@element-plus'))) {
            return 'vendor-element-plus'
          }
        }
      }
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
  }
  // 无 css.preprocessorOptions：原 additionalData 注入 variables.scss 会把 :root CSS 块
  // 复制进每个编译单元（它并不定义 SCSS $ 变量），深/浅色统一由 EP --el-* 变量承担（方案 P2-3）
})