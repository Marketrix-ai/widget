/**
 * The widget's ESLint config.
 *
 * Bans bare `document.activeElement` (`useFocusTrap`/jsdom tests exempted), the bare `localStorage`
 * global (confined to `StorageService.ts`), a `cn()` helper call (no CSS framework), a value import of
 * `WidgetSettingsDataSchema` outside `src/sdk/`/`src/test/` (drags zod's runtime into the bundle), a
 * second `FINISH_TOOL` declarator or stray `'finish'` literal outside `BrowserToolService.ts`, and every
 * `console.*` call except `error` everywhere and `warn` in `src/utils/log.ts` alone — each replaces a
 * former source-text-regex test with a lint rule. `jsx-a11y`'s `no-static-element-interactions`/
 * `click-events-have-key-events` cover interactive-div a11y. Unused imports/ordering are delegated to
 * dedicated plugins, and `Bun` is a global for `bun run` scripts.
 */

import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import-x';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import unusedImports from 'eslint-plugin-unused-imports';
import prettierConfig from 'eslint-config-prettier';

export default [
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: ['./tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        console: 'readonly',
        Bun: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        process: 'readonly',
        fetch: 'readonly',
        FormData: 'readonly',
        File: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        Buffer: 'readonly',
        React: 'readonly',
        JSX: 'readonly',
        HTMLDivElement: 'readonly',
        HTMLInputElement: 'readonly',
        MouseEvent: 'readonly',
        Element: 'readonly',
        EventTarget: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        vi: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        require: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      import: importPlugin,
      'jsx-a11y': jsxA11y,
      'simple-import-sort': simpleImportSort,
      'unused-imports': unusedImports,
    },
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'document',
          property: 'activeElement',
          message:
            'reads the shadow HOST, not the focused widget element — use activeElementIn() from components/navigation/MessengerShell',
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'localStorage', message: 'use StorageService.readLocal/writeLocal instead of the bare global' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.name='cn']",
          message: 'no CSS-framework cn() helper in this codebase — resolveLayoutStyle/inline styles only',
        },
        {
          selector: "VariableDeclarator[id.name='FINISH_TOOL']",
          message: 'FINISH_TOOL is defined once, in services/BrowserToolService.ts — import the constant',
        },
        {
          selector: "Literal[value='finish']",
          message: "the 'finish' tool name is the FINISH_TOOL constant everywhere but its one definition",
        },
      ],
      'jsx-a11y/no-static-element-interactions': 'error',
      'jsx-a11y/click-events-have-key-events': 'error',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**'],
              importNames: ['WidgetSettingsDataSchema'],
              message:
                'a value import of any zod schema outside src/sdk/ or src/test/ pulls the whole zod runtime into every host page — import the WidgetSettingsData type instead',
            },
          ],
        },
      ],
      'no-console': ['error', { allow: ['error'] }],
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-require-imports': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/consistent-type-exports': 'error',
      '@typescript-eslint/no-import-type-side-effects': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/prefer-optional-chain': 'warn',
      '@typescript-eslint/require-array-sort-compare': 'error',
      '@typescript-eslint/restrict-plus-operands': 'error',
      '@typescript-eslint/restrict-template-expressions': 'warn',

      'import/no-duplicates': 'error',
      'import/no-unresolved': 'off',
      'import/order': 'off',
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],

      'no-debugger': 'error',
      'no-duplicate-imports': 'error',
      'no-unused-vars': 'off',
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-template': 'error',
      'spaced-comment': ['error', 'always', { markers: ['/'] }],
      'max-len': [
        'warn',
        {
          code: 120,
          ignoreUrls: true,
          ignoreStrings: true,
          ignoreTemplateLiterals: true,
          ignoreRegExpLiterals: true,
        },
      ],
    },
  },
  prettierConfig,
  {
    files: ['src/components/navigation/MessengerShell.tsx', '**/*.test.ts', '**/*.test.tsx'],
    rules: {
      'no-restricted-properties': 'off',
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', 'src/test/**'],
    rules: {
      'no-restricted-globals': 'off',
      'no-restricted-imports': 'off',
      'no-console': 'off',
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.name='cn']",
          message: 'no CSS-framework cn() helper in this codebase — resolveLayoutStyle/inline styles only',
        },
      ],
    },
  },
  {
    files: ['src/services/StorageService.ts'],
    rules: {
      'no-restricted-globals': 'off',
    },
  },
  {
    files: ['src/services/BrowserToolService.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.name='cn']",
          message: 'no CSS-framework cn() helper in this codebase — resolveLayoutStyle/inline styles only',
        },
      ],
    },
  },
  {
    files: ['src/utils/log.ts'],
    rules: {
      'no-console': ['error', { allow: ['warn'] }],
    },
  },
  {
    files: ['scripts/**', '*.config.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    ignores: [
      'node_modules/',
      'dist/',
      'build/',
      '*.js',
      'scripts/*.mjs',
      '*.d.ts',
      'public/',
      'src/sdk/**/*',
      '.claude/**',
    ],
  },
];
