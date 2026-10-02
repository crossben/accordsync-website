import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    // With noUncheckedIndexedAccess, `!` is how we state an index is known to exist.
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
  {
    files: ['load/k6/**/*.js'],
    languageOptions: { globals: { __ENV: 'readonly', __VU: 'readonly', __ITER: 'readonly' } },
  },
  {
    files: ['packages/core/src/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      // The merge core is pure: no clock reads, no randomness, no I/O.
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'Inject time; the core never reads the clock.' },
        { name: 'fetch', message: 'The core does no I/O.' },
        { name: 'setTimeout', message: 'The core does no scheduling.' },
        { name: 'crypto', message: 'Inject randomness.' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Inject randomness.' },
      ],
    },
  },
);
