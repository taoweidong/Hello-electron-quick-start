"use strict";
// 共享常量定义
Object.defineProperty(exports, "__esModule", { value: true });
exports.STORAGE_KEYS = exports.THEMES = exports.PLATFORMS = exports.APP_CONSTANTS = void 0;
/**
 * 应用常量
 */
exports.APP_CONSTANTS = {
    APP_NAME: 'My Electron App',
    VERSION: '1.0.0',
    AUTHOR: 'Your Name'
};
/**
 * 系统平台常量
 */
exports.PLATFORMS = {
    WINDOWS: 'win32',
    MACOS: 'darwin',
    LINUX: 'linux'
};
/**
 * 主题常量
 */
exports.THEMES = {
    LIGHT: 'light',
    DARK: 'dark'
};
/**
 * 本地存储键名
 */
exports.STORAGE_KEYS = {
    SETTINGS: 'app_settings',
    USER_INFO: 'user_info'
};
