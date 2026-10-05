// 主题闭环（方案 P2-3）：settings 表 theme 值驱动 html.dark class，
// Element Plus 深色 css-vars（main.ts 引入）据此翻转全部 --el-* 变量。

export type Theme = 'light' | 'dark'

// 纯函数（零 DOM/零 electron，tests/theme.test.ts 直测）：
// 白名单收编——只有精确 'dark' 视为深色，DB 脏值/缺失一律回落 light
export function resolveTheme(raw: unknown): Theme {
  return raw === 'dark' ? 'dark' : 'light'
}

export function applyTheme(raw: unknown): Theme {
  const theme = resolveTheme(raw)
  document.documentElement.classList.toggle('dark', theme === 'dark')
  return theme
}
