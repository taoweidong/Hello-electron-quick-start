<template>
  <section class="stat-rail app-surface" role="group" :aria-label="ariaLabel">
    <article
      v-for="item in items"
      :key="item.label"
      class="stat-cell"
      :class="`is-${item.tone}`"
    >
      <span class="stat-cell__icon">
        <el-icon :size="19"><component :is="item.icon" /></el-icon>
      </span>
      <div class="stat-cell__body">
        <span class="stat-cell__label">{{ item.label }}</span>
        <strong>{{ loading ? '—' : item.value }}</strong>
        <span class="stat-cell__hint">{{ item.hint }}</span>
      </div>
    </article>
  </section>
</template>

<script setup lang="ts">
import type { StatRailItem } from '@/utils/ui'

withDefaults(
  defineProps<{
    items: StatRailItem[]
    loading?: boolean
    ariaLabel?: string
  }>(),
  { loading: false, ariaLabel: '统计概览' }
)
</script>

<style scoped>
.stat-rail {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  overflow: hidden;
}

.stat-cell {
  --stat-color: var(--el-color-primary);
  display: flex;
  align-items: center;
  gap: 13px;
  min-width: 0;
  padding: 17px 20px;
}

.stat-cell + .stat-cell {
  border-left: 1px solid var(--el-border-color-lighter);
}

.stat-cell.is-success {
  --stat-color: var(--el-color-success);
}

.stat-cell.is-warning {
  --stat-color: var(--el-color-warning);
}

.stat-cell.is-danger {
  --stat-color: var(--el-color-danger);
}

.stat-cell.is-info {
  --stat-color: var(--el-color-info);
}

.stat-cell__icon {
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  color: var(--stat-color);
  background: color-mix(in srgb, var(--stat-color) 11%, transparent);
}

.stat-cell__body {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.stat-cell__label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.stat-cell__body strong {
  margin-top: 1px;
  font-family: var(--app-font-display);
  font-size: 25px;
  line-height: 1.18;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
  color: var(--el-text-color-primary);
}

.stat-cell__hint {
  margin-top: 2px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 1100px) {
  .stat-rail {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .stat-cell + .stat-cell {
    border-left: none;
  }

  .stat-cell:nth-child(even) {
    border-left: 1px solid var(--el-border-color-lighter);
  }

  .stat-cell:nth-child(n + 3) {
    border-top: 1px solid var(--el-border-color-lighter);
  }
}

@media (max-width: 640px) {
  .stat-rail {
    grid-template-columns: 1fr;
  }

  .stat-cell,
  .stat-cell:nth-child(even),
  .stat-cell + .stat-cell {
    border-left: none;
  }

  .stat-cell + .stat-cell {
    border-top: 1px solid var(--el-border-color-lighter);
  }
}
</style>