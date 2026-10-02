declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, any>, Record<string, any>, any>
  export default component
}

// 样式副作用导入（TS 6 起对无法解析的副作用导入报 TS2882）
declare module '*.css'
declare module '*.scss'
