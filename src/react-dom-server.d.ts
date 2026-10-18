// El mapa de la versión web arma las tarjetas de los clientes con renderToStaticMarkup; la app no instala @types/react-dom
// (choca con la versión fija de React de Expo), así que se declara solo lo que se usa.
declare module "react-dom/server" {
  export function renderToStaticMarkup(element: unknown): string;
}
