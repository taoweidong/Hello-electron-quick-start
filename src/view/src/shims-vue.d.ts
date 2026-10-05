// .vue 模块声明：vue-tsc 能直接解析 SFC，但 ESLint 的类型感知程序（普通 tsc）不能，
// 少了它 `import App from './App.vue'` 就成了 error 类型（方案 P2-4 消 any）
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

// 样式副作用导入（TS 6 起对无法解析的副作用导入报 TS2882）
declare module '*.css'
declare module '*.scss'
