<template>
  <header class="app-topbar">
    <div class="app-topbar__titles">
      <span class="app-topbar__eyebrow">{{ appName }}</span>
      <div class="app-topbar__heading">
        <h2>{{ title }}</h2>
        <span v-if="description" class="app-topbar__description">{{ description }}</span>
      </div>
    </div>

    <div class="app-topbar__actions">
      <el-tag round effect="plain" class="local-chip">
        <el-icon><Coin /></el-icon>
        <span>本地存储</span>
      </el-tag>
      <span class="topbar-date">{{ todayLabel }}</span>
      <el-tooltip :content="isDark ? '切换到浅色模式' : '切换到深色模式'" placement="bottom">
        <button
          type="button"
          class="theme-button"
          :aria-label="isDark ? '切换到浅色模式' : '切换到深色模式'"
          @click="handleToggleTheme"
        >
          <el-icon :size="17">
            <Sunny v-if="isDark" />
            <Moon v-else />
          </el-icon>
        </button>
      </el-tooltip>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Coin, Moon, Sunny } from '@element-plus/icons-vue'
import { APP_CONSTANTS } from '@shared/constants'
import { useTheme } from '@/composables/useTheme'

defineProps<{ title: string; description?: string }>()

const appName = APP_CONSTANTS.APP_NAME
const { isDark, toggleTheme } = useTheme()

const todayLabel = computed(() =>
  new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  }).format(new Date())
)

function handleToggleTheme(): void {
  void toggleTheme()
}
</script>

<style scoped>
.app-topbar {
  flex: 0 0 var(--app-topbar-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 0 28px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: color-mix(in srgb, var(--el-bg-color) 88%, transparent);
  backdrop-filter: blur(14px);
}

.app-topbar__titles {
  min-width: 0;
}

.app-topbar__eyebrow {
  display: block;
  margin-bottom: 2px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--el-text-color-placeholder);
}

.app-topbar__heading {
  display: flex;
  align-items: baseline;
  gap: 12px;
  min-width: 0;
}

.app-topbar__heading h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  white-space: nowrap;
}

.app-topbar__description {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-topbar__actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 0 0 auto;
}

.local-chip {
  --el-tag-bg-color: var(--el-fill-color-lighter);
  --el-tag-border-color: var(--el-border-color-lighter);
  --el-tag-text-color: var(--el-text-color-secondary);
  gap: 4px;
}

.local-chip :deep(.el-icon) {
  margin-right: 4px;
  color: var(--el-color-success);
}

.topbar-date {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.theme-button {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  color: var(--el-text-color-regular);
  background: var(--el-bg-color);
  cursor: pointer;
  transition: all var(--app-transition);
}

.theme-button:hover {
  color: var(--el-color-primary);
  border-color: color-mix(in srgb, var(--el-color-primary) 36%, var(--el-border-color-lighter));
  background: color-mix(in srgb, var(--el-color-primary) 8%, var(--el-bg-color));
}

.theme-button:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}

@media (max-width: 1080px) {
  .topbar-date,
  .app-topbar__description {
    display: none;
  }
}
</style>