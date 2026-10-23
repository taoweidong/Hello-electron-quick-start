import type { Component } from 'vue'

/** 统计条色调：只映射到 Element Plus 语义色，具体色值由 --el-* 决定 */
export type StatTone = 'primary' | 'success' | 'warning' | 'danger' | 'info'

export interface StatRailItem {
  label: string
  value: number | string
  hint: string
  tone: StatTone
  icon: Component
}