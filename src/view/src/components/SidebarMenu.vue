<template>
  <el-menu
    :default-active="activeMenu"
    class="sidebar-menu"
    router
    background-color="var(--el-bg-color-page)"
    text-color="var(--el-text-color-regular)"
    active-text-color="var(--el-color-primary)"
  >
    <template v-for="route in menuRoutes" :key="route.name">
      <el-menu-item :index="route.path">
        <el-icon>
          <component :is="route.meta?.icon" />
        </el-icon>
        <span>{{ route.meta?.title }}</span>
      </el-menu-item>
    </template>
  </el-menu>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import router from '@/router'

const route = useRoute()

const activeMenu = computed(() => route.path)

const menuRoutes = computed(() => {
  return router.getRoutes().filter(route => 
    route.meta && route.meta.title && !route.meta.hidden
  ).sort((a, b) => {
    const orderA = a.meta.order as number || 0
    const orderB = b.meta.order as number || 0
    return orderA - orderB
  })
})
</script>

<style lang="scss" scoped>
.sidebar-menu {
  border: none;
  height: 100%;
  padding: 8px 0;
  
  .el-menu-item {
    margin: 2px 8px;
    border-radius: 6px;
    height: 44px;
    line-height: 44px;
    
    &.is-active {
      background-color: var(--el-color-primary-light-9);
      font-weight: 500;
    }
    
    &:hover {
      background-color: var(--el-color-primary-light-8);
    }
    
    .el-icon {
      font-size: 18px;
      margin-right: 8px;
    }
    
    span {
      font-size: 14px;
    }
  }
}
</style>