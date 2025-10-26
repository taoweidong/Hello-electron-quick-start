<template>
  <div id="app">
    <el-container class="layout-container">
      <el-main class="layout-main">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
    </el-container>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
// @ts-ignore
import SidebarMenu from '@/components/SidebarMenu.vue'

// 移除了窗口控制相关的方法和状态
</script>

<style lang="scss">
#app {
  height: 100vh;
  overflow: hidden;
  
  .layout-container {
    height: 100%;
    
    .layout-main {
      background: var(--el-bg-color);
      padding: 0;
      overflow: hidden;
    }
  }
}

// 全局样式重置
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Helvetica Neue', Helvetica, 'PingFang SC', 'Hiragino Sans GB',
    'Microsoft YaHei', '微软雅黑', Arial, sans-serif;
  background: var(--el-bg-color);
}

// 路由过渡动画
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
