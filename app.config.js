/**
 * Gather's Expo config is app.json. This file only adjusts it for the
 * single-file web preview (scripts/single-file.mjs): GATHER_SINGLE_FILE=1
 * turns off per-route bundle splitting so the web export is one script.
 */
module.exports = ({ config }) => {
  if (process.env.GATHER_SINGLE_FILE !== '1') return config;
  const plugins = (config.plugins ?? []).map((plugin) => {
    if (plugin === 'expo-router') return ['expo-router', { asyncRoutes: false }];
    if (Array.isArray(plugin) && plugin[0] === 'expo-router') return ['expo-router', { ...plugin[1], asyncRoutes: false }];
    return plugin;
  });
  return { ...config, plugins };
};
