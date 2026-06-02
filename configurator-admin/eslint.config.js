// ESLint v9 flat config. Replaces the old `.eslintrc` + `--ext` setup, which
// ESLint 9 no longer supports. Mirrors the standard Vite + React + TS ruleset
// using the packages already in devDependencies (no new deps added).
import js from '@eslint/js'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

export default [
  // Ignores (replaces .eslintignore). Build output, deps, and the committed
  // widget bundle that the admin serves verbatim.
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'public/widget.js',
      'playwright-report/**',
      'test-results/**',
      'coverage/**',
    ],
  },

  // Base JS recommended rules.
  js.configs.recommended,

  // App source: browser + React, type-aware-light (no project service to keep
  // lint fast and avoid requiring every file to be in a tsconfig include).
  {
    files: ['src/**/*.{ts,tsx}', 'tests-visual/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2020,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.es2021 },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-hooks': reactHooks,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // TS handles undefined-var checking; the base rule produces false
      // positives on types and JSX globals.
      'no-undef': 'off',
      // Allow intentionally-unused args/vars prefixed with underscore.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // `any` is widespread in this (previously un-linted) codebase. Keep it
      // visible as a warning rather than blocking, so new usage is noticed
      // without forcing a mass retype.
      '@typescript-eslint/no-explicit-any': 'warn',
      // The PDF/DOCX renderers strip control characters from user text by
      // design (e.g. /[\x00-\x1f]/), so control chars in those regexes are
      // intentional, not a mistake.
      'no-control-regex': 'off',
      // shadcn-style prop interfaces extend an HTML element's props with no
      // extra members (`interface InputProps extends ...Attributes {}`), which
      // is a deliberate, harmless pattern here.
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },

  // Node-context config + script files (vite/vitest/tailwind/postcss/playwright).
  {
    files: ['*.{js,cjs,ts}', '*.config.{js,cjs,ts}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      // CommonJS config files (tailwind, postcss) legitimately use require().
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
]
