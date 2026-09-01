import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import prettier from 'eslint-config-prettier'

export default [
  { ignores: ['dist', 'dev-dist', 'node_modules'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: '18.3' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^[A-Z_]' }],
      // React Compiler diagnostics from eslint-plugin-react-hooks v6 flag
      // patterns that are legal in classic React (sync setState in effects,
      // read-before-declare, ref access during render). This codebase predates
      // the Compiler; keep the classic rules (rules-of-hooks, exhaustive-deps)
      // as the enforced baseline and phase these in deliberately.
      'react-hooks/immutability': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'warn',
      // The codebase uses plain JSX props without prop-types; TypeScript is
      // the intended replacement for runtime prop validation.
      'react/prop-types': 'off',
    },
  },
  // Must be last: disables ESLint rules that conflict with Prettier.
  prettier,
]
