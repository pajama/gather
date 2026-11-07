// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

/** Layer rules from AGENTS.md: dependencies point down only. */
const layer = (files, forbidden, message) => ({
  files,
  rules: {
    'no-restricted-imports': ['error', { patterns: forbidden.map((group) => ({ group: [group], message })) }],
  },
});

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'screenshots/*', '.expo/*'],
  },
  layer(
    ['src/core/**'],
    ['react', 'react-native', 'react-native-*', 'expo', 'expo-*', '@/data/*', '@/features/*', '@/ui', '@/ui/*', '@/app/*'],
    'src/core is pure TypeScript domain logic: no React, React Native, Expo or app layers.',
  ),
  layer(['src/data/**'], ['@/features/*', '@/ui', '@/ui/*', '@/app/*'], 'src/data must not depend on UI or features.'),
  layer(['src/ui/**'], ['@/data/*', '@/features/*', '@/app/*', '@/core/*'], 'src/ui is the design system: no domain or data knowledge.'),
]);
