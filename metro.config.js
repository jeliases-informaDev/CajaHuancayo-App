const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// leaflet (usado solo en las pantallas .web.tsx, para el mapa en el navegador) publica
// un "main" que apunta a un archivo fuente que no viene en el paquete de npm; Metro,
// a diferencia de Webpack/Vite, no sigue el campo "browser" por defecto. Se prioriza
// "browser"/"module" para que resuelva al bundle ya compilado (dist/leaflet.js).
config.resolver.resolverMainFields = ['browser', 'module', 'main'];

module.exports = config;
