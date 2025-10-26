<template>
  <div id="app">
    <el-container class="layout-container">
      <el-header class="layout-header">
        <div class="header-content">
          <div class="header-left">
            <h1 class="app-title">{{ appName }}</h1>
          </div>
          <div class="header-center">
            <span class="app-version">v{{ appVersion }}</span>
          </div>
          <div class="header-right">
            <el-button-group>
              <el-button 
                :icon="Minus" 
                @click="minimizeWindow"
                size="small"
                text
              />
              <el-button 
                :icon="FullScreen" 
                @click="maximizeWindow"
                size="small"
                text
              />
              <el-button 
                :icon="Close" 
                @click="closeWindow"
                size="small"
                text
              />
            </el-button-group>
          </div>
        </div>
      </el-header>
      
      <el-container>
        <el-aside width="240px" class="layout-sidebar">
          <SidebarMenu />
        </el-aside>
        
        <el-main class="layout-main">
          <router-view v-slot="{ Component }">
            <transition name="fade" mode="out-in">
              <component :is="Component" />
            </transition>
          </router-view>
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Minus, FullScreen, Close } from '@element-plus/icons-vue'
// @ts-ignore
import SidebarMenu from '@/components/SidebarMenu.vue'

const appName = ref('My Electron App')
const appVersion = ref('1.0.0')

const minimizeWindow = async () => {
  // @ts-ignore
  if (window.electronAPI) {
    try {
      // @ts-ignore
      await window.electronAPI.minimizeWindow()
    } catch (error) {
      console.warn('无法最小化窗口:', error)
    }
  }
}

const maximizeWindow = async () => {
  // @ts-ignore
  if (window.electronAPI) {
    try {
      // @ts-ignore
      await window.electronAPI.maximizeWindow()
    } catch (error) {
      console.warn('无法最大化窗口:', error)
    }
  }
}

const closeWindow = async () => {
  // @ts-ignore
  if (window.electronAPI) {
    try {
      // @ts-ignore
      await window.electronAPI.closeWindow()
    } catch (error) {
      console.warn('无法关闭窗口:', error)
    }
  }
}

onMounted(async () => {
  // @ts-ignore
  if (window.electronAPI) {
    try {
      // @ts-ignore
      const version = await window.electronAPI.getAppVersion()
      appVersion.value = version
    } catch (error) {
      console.warn('无法获取应用版本:', error)
    }
  }
})
</script>

<style lang="scss">
#app {
  height: 100vh;
  overflow: hidden;
  
  .layout-container {
    height: 100%;
    
    .layout-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-bottom: 1px solid var(--el-border-color);
      padding: 0 16px;
      display: flex;
      align-items: center;
      -webkit-app-region: drag;
      
      .header-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        
        .header-left,
        .header-center,
        .header-right {
          flex: 1;
          display: flex;
          align-items: center;
        }
        
        .header-center {
          justify-content: center;
        }
        
        .header-right {
          justify-content: flex-end;
        }
        
        .app-title {
          color: white;
          margin: 0;
          font-size: 16px;
          font-weight: 600;
        }
        
        .app-version {
          color: rgba(255, 255, 255, 0.8);
          font-size: 12px;
        }
        
        .el-button-group {
          -webkit-app-region: no-drag;
          
          .el-button {
            color: white;
            background: rgba(255, 255, 255, 0.1);
            border: none;
            border-radius: 0;
            
            &:hover {
              background: rgba(255, 255, 255, 0.2);
            }
            
            &:last-child:hover {
              background: rgba(255, 0, 0, 0.6);
            }
          }
        }
      }
    }
    
    .layout-sidebar {
      background: var(--el-bg-color-page);
      border-right: 1px solid var(--el-border-color);
    }
    
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
