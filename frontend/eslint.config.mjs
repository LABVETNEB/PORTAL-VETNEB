import * as espree from 'espree';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

const nextConfig = Array.isArray(nextCoreWebVitals)
  ? nextCoreWebVitals
  : [nextCoreWebVitals];

const eslintConfig = [
  ...nextConfig,
  {
    settings: {
      react: {
        // Avoid eslint-plugin-react 7.37.5 auto-detect path that calls a removed ESLint 10 helper.
        version: '19.2.7',
      },
    },
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      // Keep plain JS on ESLint's native parser; Next's wrapper returns an ESLint 10-incompatible scope manager.
      parser: espree,
    },
  },
  {
    rules: {
      // react-hooks 7 adds compiler-style checks that flag existing effect fetch/state patterns outside this PR.
      'react-hooks/immutability': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    ignores: [
      '.next/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
    ],
  },
];

export default eslintConfig;
