// 共享常量定义

/**
 * 应用常量
 */
export const APP_CONSTANTS = {
  APP_NAME: 'My Electron App',
  VERSION: '1.0.0',
  AUTHOR: 'Your Name'
} as const

/**
 * 系统平台常量
 */
export const PLATFORMS = {
  WINDOWS: 'win32',
  MACOS: 'darwin',
  LINUX: 'linux'
} as const

/**
 * 主题常量
 */
export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark'
} as const

/**
 * 本地存储键名
 */
export const STORAGE_KEYS = {
  SETTINGS: 'app_settings',
  USER_INFO: 'user_info'
} as const