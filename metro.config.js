const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// leaflet (usado solo en las pantallas .web.tsx, para el mapa en el navegador) publica
// un "main" que apunta a un archivo fuente que no viene en el paquete de npm; Metro,
// a diferencia de Webpack/Vite, no sigue el campo "browser" por defecto. Se necesita
// priorizar "browser"/"module" para que resuelva al bundle ya compilado (dist/leaflet.js),
// pero SOLO para plataforma web y SOLO para este paquete: aplicarlo de forma global
// (config.resolver.resolverMainFields) hace que Metro resuelva también los paquetes
// nativos (p. ej. react-native-safe-area-context) por su build ESM en vez del build
// react-native/commonjs, lo que rompe el codegen de specs nativas en el build Android/iOS.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform, ...rest) => {
  if (moduleName === 'leaflet' && platform === 'web') {
    return context.resolveRequest(
      { ...context, resolverMainFields: ['browser', 'module', 'main'] },
      moduleName,
      platform,
    );
  }
  if (defaultResolveRequest) return defaultResolveRequest(context, moduleName, platform, ...rest);
  return context.resolveRequest(context, moduleName, platform, ...rest);
};

module.exports = config;
