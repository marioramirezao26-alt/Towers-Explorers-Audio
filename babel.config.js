module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // three.js (usado por GabyVrmFace) usa "static class blocks", una sintaxis
      // que el preset de Expo no habilita por defecto.
      '@babel/plugin-transform-class-static-block',
      [
        'module-resolver',
        {
          root: ['.'],
          alias: { '@': './src' },
          extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
        },
      ],
    ],
  };
};
