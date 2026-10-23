import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { APP_CONSTANTS } from '@shared/constants'

// 路由 meta 类型单一来源：模板串/读取处不再拿到 unknown（方案 B4，消 no-base-to-string）
declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    description?: string
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/HomeView.vue'),
    meta: {
      title: '概览',
      description: '任务、文件与运行环境的统一入口'
    }
  },
  {
    path: '/tasks',
    name: 'Tasks',
    component: () => import('@/views/TasksView.vue'),
    meta: {
      title: '任务管理',
      description: '完整 CRUD 示例：筛选、分页、批量操作与表单校验'
    }
  },
  {
    path: '/files',
    name: 'Files',
    component: () => import('@/views/FilesView.vue'),
    meta: {
      title: '文件管理',
      description: '解压 ZIP / RAR，浏览文件树并预览内容'
    }
  },
  {
    path: '/plugins',
    name: 'Plugins',
    component: () => import('@/views/PluginsView.vue'),
    meta: {
      title: '插件',
      description: '本地插件注册、初始化脚本执行与运行日志'
    }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('@/views/SettingsView.vue'),
    meta: {
      title: '设置',
      description: '主题、工作目录与软件更新'
    }
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 })
})

// vue-router 5 起 `next()` 回调形态已废弃（VUE_ROUTER_R0025）：守卫不返回即视为放行
router.beforeEach((to) => {
  // 设置页面标题（RouteMeta.title 已由上方模块增强声明为 string，模板串安全）
  if (to.meta.title) {
    document.title = `${to.meta.title} - ${APP_CONSTANTS.APP_NAME}`
  }
})

export default router