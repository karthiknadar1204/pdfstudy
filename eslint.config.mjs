import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

const eslintConfig = [
  ...compat.config({
    extends: ['next/core-web-vitals', 'next/typescript'],
    rules: {
      // Disable all ESLint rules
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-unused-vars': 'off',
      'no-console': 'off',
      'no-undef': 'off',
      'no-unreachable': 'off',
      'no-empty': 'off',
      'no-useless-escape': 'off',
      'no-mixed-spaces-and-tabs': 'off',
      'no-trailing-spaces': 'off',
      'no-multiple-empty-lines': 'off'
    }
  }),
];

export default eslintConfig;
