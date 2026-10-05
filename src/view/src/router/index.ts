import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

// 路由 meta 类型单一来源：模板串/读取处不再拿到 unknown（方案 B4，消 no-base-to-string）
declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    icon?: string
    keepAlive?: boolean
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Files',
    component: () => import('@/views/FilesView.vue'),
    meta: {
      title: '文件管理',
      icon: 'Folder',
      keepAlive: true
    }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('@/views/SettingsView.vue'),
    meta: {
      title: '设置',
      icon: 'Setting',
      keepAlive: true
    }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  // 设置页面标题（RouteMeta.title 已由下方模块增强声明为 string，模板串安全）
  if (to.meta.title) {
    document.title = `${to.meta.title} - My Electron App`
  }
  next()
})

export default router