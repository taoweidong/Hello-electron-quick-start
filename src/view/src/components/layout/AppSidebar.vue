<template>
  <aside class="app-sidebar" :class="{ 'is-collapsed': collapsed }">
    <div class="brand">
      <div class="brand__mark">
        <el-icon :size="20"><Monitor /></el-icon>
      </div>
      <div v-if="!collapsed" class="brand__text">
        <strong>{{ appName }}</strong>
        <span>桌面工作台</span>
      </div>
    </div>

    <el-menu
      :default-active="activePath"
      router
      :collapse="collapsed"
      :collapse-transition="false"
      class="app-nav"
      aria-label="主导航"
    >
      <el-menu-item v-for="item in navItems" :key="item.path" :index="item.path">
        <el-icon><component :is="item.icon" /></el-icon>
        <template #title>{{ item.label }}</template>
      </el-menu-item>
    </el-menu>

    <div class="sidebar-footer">
      <div v-if="!collapsed" class="storage-card">
        <span class="storage-card__label">本地数据</span>
        <span class="storage-card__value">SQLite · tasks</span>
      </div>
      <div class="sidebar-meta">
        <span v-if="!collapsed" class="version">v{{ version || '…' }}</span>
        <el-tooltip :content="collapsed ? '展开侧边栏' : '收起侧边栏'" placement="right">
          <button
            type="button"
            class="collapse-button"
            :aria-label="collapsed ? '展开侧边栏' : '收起侧边栏'"
            :aria-expanded="!collapsed"
            @click="emit('toggle')"
          >
            <el-icon><component :is="collapsed ? Expand : Fold" /></el-icon>
          </button>
        </el-tooltip>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { Component } from 'vue'
import { useRoute } from 'vue-router'
import {
  Expand,
  Fold,
  FolderOpened,
  Monitor,
  Odometer,
  Setting,
  Tickets
} from '@element-plus/icons-vue'
import { APP_CONSTANTS } from '@shared/constants'

defineProps<{ collapsed: boolean }>()
const emit = defineEmits<{ toggle: [] }>()

const route = useRoute()
const appName = APP_CONSTANTS.APP_NAME
const version = ref('')

const activePath = computed(() => route.path)

const navItems: Array<{ path: string; label: string; icon: Component }> = [
  { path: '/', label: '概览', icon: Odometer },
  { path: '/tasks', label: '任务管理', icon: Tickets },
  { path: '/files', label: '文件管理', icon: FolderOpened },
  { path: '/settings', label: '设置', icon: Setting }
]

onMounted(async () => {
  try {
    const result = await window.electronAPI.getAppVersion()
    if (result.ok) version.value = result.data
  } catch {
    // 版本号仅作展示，读取失败不阻塞导航
  }
})
</script>

<style scoped>
.app-sidebar {
  width: 236px;
  flex: 0 0 236px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--el-bg-color);
  border-right: 1px solid var(--el-border-color-lighter);
  transition: width var(--app-transition), flex-basis var(--app-transition);
}

.app-sidebar.is-collapsed {
  width: 76px;
  flex-basis: 76px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 76px;
  padding: 0 18px;
}

.brand__mark {
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  border-radius: 13px;
  display: grid;
  place-items: center;
  color: var(--el-color-white);
  background:
    linear-gradient(135deg, var(--el-color-primary), color-mix(in srgb, var(--el-color-primary) 48%, var(--el-color-success)));
  box-shadow: 0 10px 20px color-mix(in srgb, var(--el-color-primary) 28%, transparent);
}

.brand__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.brand__text strong {
  font-size: 15px;
  letter-spacing: -0.01em;
  color: var(--el-text-color-primary);
  white-space: nowrap;
}

.brand__text span {
  margin-top: 2px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.app-nav {
  flex: 1;
  padding: 6px 10px;
  border-right: none;
  overflow-y: auto;
  --el-menu-bg-color: transparent;
  --el-menu-text-color: var(--el-text-color-regular);
  --el-menu-active-color: var(--el-color-primary);
  --el-menu-hover-bg-color: var(--el-fill-color-light);
  --el-menu-item-height: 44px;
}

.app-nav:not(.el-menu--collapse) {
  width: 100%;
}

:deep(.el-menu-item) {
  position: relative;
  height: 44px;
  margin: 3px 0;
  border-radius: 11px;
  font-weight: 500;
  transition: background-color var(--app-transition), color var(--app-transition);
}

:deep(.el-menu-item .el-icon) {
  font-size: 18px;
}

:deep(.el-menu-item.is-active) {
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 12%, transparent);
}

:deep(.el-menu-item.is-active::before) {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  width: 3px;
  height: 18px;
  border-radius: 999px;
  transform: translateY(-50%);
  background: var(--el-color-primary);
}

.app-nav.el-menu--collapse {
  padding: 6px 8px;
}

:deep(.el-menu--collapse .el-menu-item) {
  justify-content: center;
  padding: 0;
}

.sidebar-footer {
  padding: 14px 14px 16px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.storage-card {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 11px 12px;
  margin-bottom: 12px;
  border-radius: 12px;
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-lighter);
}

.storage-card__label {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.storage-card__value {
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 12px;
  color: var(--el-text-color-primary);
}

.sidebar-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.version {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}

.collapse-button {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  margin-left: auto;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 9px;
  color: var(--el-text-color-regular);
  background: var(--el-bg-color);
  cursor: pointer;
  transition: all var(--app-transition);
}

.collapse-button:hover {
  color: var(--el-color-primary);
  border-color: color-mix(in srgb, var(--el-color-primary) 36%, var(--el-border-color-lighter));
  background: color-mix(in srgb, var(--el-color-primary) 8%, var(--el-bg-color));
}

.collapse-button:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}

.app-sidebar.is-collapsed .brand {
  justify-content: center;
  padding: 0;
}

.app-sidebar.is-collapsed .sidebar-footer {
  padding: 14px 10px 16px;
}

.app-sidebar.is-collapsed .sidebar-meta {
  justify-content: center;
}
</style>