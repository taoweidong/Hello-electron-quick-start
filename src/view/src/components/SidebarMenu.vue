<template>
  <el-menu
    :default-active="activeMenu"
    class="sidebar-menu"
    router
    background-color="var(--el-bg-color-page)"
    text-color="var(--el-text-color-regular)"
    active-text-color="var(--el-color-primary)"
  >
    <el-menu-item index="/">
      <el-icon>
        <Folder />
      </el-icon>
      <span>文件管理</span>
    </el-menu-item>
  </el-menu>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Folder } from '@element-plus/icons-vue'

const route = useRoute()

const activeMenu = computed(() => route.path)
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