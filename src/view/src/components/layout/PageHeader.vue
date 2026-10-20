<template>
  <header class="page-header">
    <div class="page-header__copy">
      <span v-if="eyebrow" class="page-header__eyebrow">{{ eyebrow }}</span>
      <h1>{{ title }}</h1>
      <p v-if="description" class="page-header__description">{{ description }}</p>
    </div>
    <div v-if="$slots.actions" class="page-header__actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    description?: string
    eyebrow?: string
  }>(),
  { description: '', eyebrow: '' }
)
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 22px;
  flex-wrap: wrap;
}

.page-header__copy {
  min-width: 0;
}

.page-header__eyebrow {
  display: inline-block;
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--el-color-primary);
}

.page-header h1 {
  margin: 0;
  font-size: 26px;
  line-height: 1.25;
  letter-spacing: -0.02em;
  color: var(--el-text-color-primary);
}

.page-header__description {
  margin: 8px 0 0;
  max-width: 720px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}

.page-header__actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
</style>