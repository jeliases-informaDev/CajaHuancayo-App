# Logo de GeoMatrix: de dónde salen los iconos

Los iconos de la app (`assets/icon.png`, `android-icon-*.png`, `splash-icon.png`, `favicon.png`) y los de la web (`CajaHuancayo-Web/public/favicon.svg`, `apple-touch-icon.png`,
`favicon-48.png` y `public/marca/geomatrix/`) **no se dibujaron a mano**: se generan con estos dos scripts a partir de la geometría del logo.

- `logo_geomatrix.py`: las medidas del logo (una «G» gruesa, el punto rojo de la visita y el círculo punteado de la geocerca), medidas sobre los JPEG
  `LOGO PARA GEOMATRIX 2-04` (icono con fondo en degradado) y `2-05` (G sobre blanco) que entregó el equipo (1257 × 1257). Cada forma se evalúa con distancias
  analíticas, así sale nítida y con transparencia a cualquier tamaño.
- `generar_logos.py`: escribe todos los archivos de arriba y una hoja de vista previa (icono iOS, icono adaptable de Android con máscara circular y redondeada, arranque y monocromo).

Colores: degradado `#4F46E5` → `#7E22CE`, punto rojo `#E30713`.

## Cómo volver a generarlos

Hace falta Python con `numpy` y `Pillow`:

```
python tools/logos/generar_logos.py <ruta de CajaHuancayo-App> <ruta de CajaHuancayo-Web> <carpeta para la vista previa>
```

Si el logo cambia, se actualizan las constantes de `logo_geomatrix.py` (se miden de nuevo sobre el archivo nuevo) y se vuelve a correr.
El primer plano del icono adaptable de Android ocupa el 56 % del lienzo: la zona segura es el 61 % central y la máscara circular deja ver el 67 %.
