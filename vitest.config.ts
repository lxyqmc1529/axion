/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/coverage/**'
      ],
      all: true,
      clean: true,
      // 即使测试失败也生成覆盖率报告
      skipFull: false
    },
    // 允许测试失败但继续生成覆盖率
    passWithNoTests: true
  },
})