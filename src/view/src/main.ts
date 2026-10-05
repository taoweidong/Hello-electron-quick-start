import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
// 深色主题变量：挂载在 html.dark class 上，由存储的 theme 值驱动（方案 P2-3）
import 'element-plus/theme-chalk/dark/css-vars.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import App from './App.vue'
import router from './router'
import { applyTheme } from './utils/theme'
import './styles/index.scss'

const app = createApp(App)

// 状态管理
app.use(createPinia())

// 路由
app.use(router)

// Element Plus
app.use(ElementPlus)

// 注册所有图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

// 挂载前先应用存储的主题，保证首帧即正确主题、无浅色闪跳；
// 读取失败（DB 脏值/IPC 异常/无 preload 环境）回落 light，finally 保证必挂载
async function boot() {
  try {
    const saved = await window.electronAPI.getSetting('theme')
    applyTheme(saved.ok ? saved.data : 'light')
  } catch {
    applyTheme('light')
  } finally {
    app.mount('#app')
  }
}

void boot()