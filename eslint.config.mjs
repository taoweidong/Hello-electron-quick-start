// ESLint 10 flat config —— 类型感知版（方案 B4/E5）
// .ts 走 recommendedTypeChecked + projectService（借各 tsconfig 发现项目）；
// .vue 与非 tsconfig 覆盖的脚本（scripts/、根级 .js/.mjs、vite.config.ts）关闭类型规则：
// 后两类不在任何 tsconfig 内，SFC 的类型完整性由 vue-tsc（npm run type-check）保证。
// no-explicit-any 由 off 降为 warn（B3 契约统一后已可收敛），unsafe 系列先 warn 过渡，
// 待办数量记进 B4 commit，后续批（P2-4）清零后升 error。
import js from '@eslint/js'
import globals from 'globals'
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'dist-test/**',
      'dist-release/**',
      'release/**',
      'node_modules/**',
      '.zcode/**'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    // 按目录显式绑定三个 tsconfig（projectService 依赖"最近 tsconfig.json"发现，
    // 根 tsconfig 改为聚合入口后不再兜底，这里用 project 精确映射，见方案 B4/E7）
    files: ['src/main/**/*.ts', 'src/shared/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json'],
        tsconfigRootDir: import.meta.dirname
      }
    }
  },
  {
    files: ['src/view/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.web.json'],
        tsconfigRootDir: import.meta.dirname
      }
    }
  },
  {
    files: ['tests/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.test.json'],
        tsconfigRootDir: import.meta.dirname
      }
    }
  },
  ...pluginVue.configs['flat/essential'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser }
    }
  },
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        defineProps: 'readonly',
        defineEmits: 'readonly',
        defineExpose: 'readonly',
        withDefaults: 'readonly'
      }
    }
  },
  {
    // 仅对参与类型检查的 .ts（及 SFC 里的语法级 any）放宽为 warn；
    // vite.config.ts 等由末尾 disableTypeChecked 再关。待办清零后升 error（P2-4）
    files: ['**/*.ts', '**/*.vue'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/restrict-template-expressions': 'warn'
    }
  },
  {
    // node:test 顶层 test() 返回 Promise 由 runner 调度，不存在游离 promise 风险
    files: ['tests/**'],
    rules: {
      '@typescript-eslint/no-floating-promises': 'off'
    }
  },
  {
    rules: {
      'vue/multi-word-component-names': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
    }
  },
  {
    // 非 tsconfig 项目成员：只跑语法层规则，避免 projectService 解析失败。
    // 必须放在最后——flat config 后者覆盖前者；且 files 不能含 `!` 取反模式
    // （ESLint 10 实测：混合正/负模式会让该对象匹配除取反外的所有文件）
    ...tseslint.configs.disableTypeChecked,
    files: ['**/*.vue', '**/*.js', '**/*.mjs', 'vite.config.ts']
  },
  {
    // 根目录 CJS 脚本（如 test-main.js）保留 require 风格
    files: ['**/*.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-var-requires': 'off'
    }
  }
)
