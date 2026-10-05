/**
 * 应用身份常量（方案 P2-2）——手工维护的唯一一处：
 * 窗口标题、文档标题、`app:getInfo`、菜单"关于"链接都读这里；
 * electron-builder.json 的 productName 与 package.json 的 author 必须与之一致
 * （`tests/identity.test.ts` 是对账守卫，漂移即红）。
 * 版本号不在这里：唯一来源是 package.json 的 version，运行时经 `app.getVersion()` 取。
 */
export const APP_CONSTANTS = {
  APP_NAME: 'My-Win-App',
  AUTHOR: 'nineaiyu',
  HOMEPAGE: 'https://github.com/taoweidong/Hello-electron-quick-start'
} as const
