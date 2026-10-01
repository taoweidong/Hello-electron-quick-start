import { defineStore } from 'pinia'

// 应用状态管理
export const useAppStore = defineStore('app', {
  state: () => ({
    // 应用设置
    settings: {
      theme: 'light',
      language: 'zh-CN'
    },
    
    // 用户信息
    user: {
      name: '',
      avatar: ''
    }
  }),
  
  getters: {
    isDarkTheme: (state) => state.settings.theme === 'dark'
  },
  
  actions: {
    updateTheme(theme: string) {
      this.settings.theme = theme
    },

    updateUser(name: string, avatar: string) {
      this.user.name = name
      this.user.avatar = avatar
    }
  }
})