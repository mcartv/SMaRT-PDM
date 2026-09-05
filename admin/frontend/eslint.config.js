import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // The app intentionally co-locates small component helpers and variants,
      // matching the installed shadcn component structure.
      'react-refresh/only-export-components': 'off',
      // Existing effects synchronize route, browser-storage, dialog, and
      // socket state with external systems.
      'react-hooks/set-state-in-effect': 'off',
      // Socket hooks expose the current imperative connection to callers.
      'react-hooks/refs': 'off',
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', args: 'none' }],
    },
  },
])
