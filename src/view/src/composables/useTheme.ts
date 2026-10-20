import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { applyTheme, resolveTheme, type Theme } from '@/utils/theme'

// 主题状态提升到模块级单例：侧边栏/顶部栏/设置页共用同一份，
// 任一处切换后其余位置立即同步（不再各自持有 theme ref）。
const theme = ref<Theme>('light')
const saving = ref(false)
let loaded = false
let loading: Promise<void> | null = null

export function useTheme() {
  const isDark = computed(() => theme.value === 'dark')

  /** 读取持久化主题；并发调用共享同一个 Promise，避免重复 IPC */
  function loadTheme(force = false): Promise<void> {
    if (loaded && !force) return Promise.resolve()
    if (loading) return loading

    loading = (async () => {
      try {
        const saved = await window.electronAPI.getSetting('theme')
        // 读取期间用户已手动切换：以用户操作为准，避免晚到的旧值把主题翻回去
        if (!saving.value) theme.value = resolveTheme(saved.ok ? saved.data : null)
      } catch {
        // preload 缺失/测试环境：跟随当前 DOM 状态，别把已正确的首帧主题翻回去
        if (!saving.value) {
          const current = document.documentElement.classList.contains('dark') ? 'dark' : 'light'
          theme.value = resolveTheme(current)
        }
      } finally {
        applyTheme(theme.value)
        loaded = true
        loading = null
      }
    })()
    return loading
  }

  /** 保存并立即应用；失败时保持原主题不变并把错误抛给用户 */
  async function setTheme(next: Theme, notify = false): Promise<boolean> {
    if (saving.value) return false
    if (theme.value === next) {
      applyTheme(next)
      return true
    }

    saving.value = true
    try {
      const result = await window.electronAPI.setSetting('theme', next)
      if (!result.ok) {
        ElMessage.error(result.error.message || '主题保存失败')
        return false
      }
      applyTheme(next)
      theme.value = next
      if (notify) {
        ElMessage.success(next === 'dark' ? '已切换到深色模式' : '已切换到浅色模式')
      }
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      ElMessage.error(`主题保存失败: ${message}`)
      return false
    } finally {
      saving.value = false
    }
  }

  function toggleTheme(): Promise<boolean> {
    return setTheme(isDark.value ? 'light' : 'dark')
  }

  return { theme, isDark, saving, loadTheme, setTheme, toggleTheme }
}