<template>
  <div class="app-shell">
    <AppSidebar :collapsed="collapsed" @toggle="toggleSidebar" />
    <div class="app-body">
      <AppTopbar :title="pageTitle" :description="pageDescription" />
      <main class="app-content">
        <router-view v-slot="{ Component }">
          <transition name="page" mode="out-in">
            <component :is="Component" :key="route.path" />
          </transition>
        </router-view>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import AppTopbar from '@/components/layout/AppTopbar.vue'
import { useTheme } from '@/composables/useTheme'
import { APP_CONSTANTS } from '@shared/constants'

const route = useRoute()
const router = useRouter()
const { loadTheme } = useTheme()

const COLLAPSE_KEY = 'mywinapp:sidebar-collapsed'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

const collapsed = ref(readCollapsed())

watch(collapsed, (value) => {
  try {
    localStorage.setItem(COLLAPSE_KEY, value ? '1' : '0')
  } catch {
    // 隐私模式/存储不可用时静默降级为本次会话内状态
  }
})

function toggleSidebar(): void {
  collapsed.value = !collapsed.value
}

const pageTitle = computed(() => route.meta.title ?? APP_CONSTANTS.APP_NAME)
const pageDescription = computed(() => route.meta.description ?? '')

// 原生菜单「新建任务」→ 统一导航到任务页；同页时 query 变化由 TasksView 消费
function handleNewTask(): void {
  void router.push({ path: '/tasks', query: { create: '1' } })
}

let offNewTask: (() => void) | null = null

onMounted(() => {
  void loadTheme()
  try {
    offNewTask = window.electronAPI.onNewTaskRequested(handleNewTask)
  } catch {
    // 没有 preload 的纯浏览器预览环境下跳过菜单联动
  }
})

onUnmounted(() => {
  offNewTask?.()
  offNewTask = null
})
</script>

<style scoped>
.app-shell {
  display: flex;
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

.app-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.app-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 24px 28px 28px;
}

.app-content > :deep(*) {
  max-width: 1440px;
  margin-inline: auto;
}
</style>