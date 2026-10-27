"""Logo de GeoMatrix reconstruido como geometria (no como foto): una «G» gruesa, un punto rojo (el lugar que se visita) y un circulo punteado
(la geocerca). Se midio sobre los JPEG que entrego el usuario (1257 x 1257). Cada forma se evalua con distancias analiticas, asi sale nitida y con
transparencia a cualquier tamano (icono de la app, primer plano del icono adaptable de Android, pantalla de arranque, favicon y logo de la web).
"""
import math
import numpy as np
from PIL import Image

D = 1257.0                      # espacio de diseno (lado del JPEG original)
CX, CY = 639.0, 633.0           # centro de la G
R, W = 447.5, 112.0             # radio de la linea central de la G y su grosor
BAR_Y = 631.0                   # linea central de la barra horizontal
FIN = math.radians(320.0)       # donde termina el arco (la boca de la G queda arriba a la derecha)
RD, WD = 255.2, 13.0            # circulo punteado: radio y grosor
RAYAS, RAYA_GRADOS = 15, 16.0   # 15 rayas de 16 grados (hueco de 8)
PUNTO = 89.5                    # radio del punto rojo
ROJO = (227, 7, 19)             # #E30713
INDIGO = (79, 70, 229)          # #4F46E5
PURPURA = (126, 34, 206)        # #7E22CE
RAYA_COLOR = (110, 90, 244)     # raya sobre fondo claro (alfa 0.8)
RAYA_ALFA = 0.8


def rejilla(S, escala=1.0, centrar=False):
    """Coordenadas de diseno de cada pixel de un lienzo de S x S. `escala`: fraccion del lienzo que ocupa el cuadro de diseno completo (1257);
    con centrar=True el centro de la G queda en el centro del lienzo."""
    n = (np.arange(S, dtype=np.float64) + 0.5) / S
    u, v = np.meshgrid(n, n)
    if centrar:
        return CX + (u - 0.5) * D / escala, CY + (v - 0.5) * D / escala
    return u * D / escala, v * D / escala


def _trazo(x, y):
    dx, dy = x - CX, y - CY
    r = np.hypot(dx, dy)
    phi = np.mod(np.arctan2(dy, dx), 2 * np.pi)
    en_arco = phi <= FIN
    e0 = np.hypot(x - (CX + R), y - CY)
    e1 = np.hypot(x - (CX + R * math.cos(FIN)), y - (CY + R * math.sin(FIN)))
    d_arco = np.where(en_arco, np.abs(r - R), np.minimum(e0, e1))
    t = np.clip((x - CX) / R, 0.0, 1.0)
    d_barra = np.hypot(x - (CX + t * R), y - BAR_Y)
    return np.minimum(d_arco, d_barra) - W / 2


def _rayas(x, y):
    dx, dy = x - CX, y - CY
    r = np.hypot(dx, dy)
    phi = np.mod(np.arctan2(dy, dx), 2 * np.pi)
    paso = 2 * np.pi / RAYAS
    u = np.mod(phi, paso)
    raya = math.radians(RAYA_GRADOS)
    # distancia con signo al borde de la raya en el sentido del giro: negativa dentro, positiva fuera
    ang = np.where(u <= raya, -np.minimum(u, raya - u), np.minimum(u - raya, paso - u)) * r
    return np.maximum(np.abs(r - RD) - WD / 2, ang)


def _punto(x, y):
    return np.hypot(x - CX, y - CY) - PUNTO


def capas(S, escala=1.0, centrar=False):
    """Cobertura (0..1, con borde suave) de cada pieza: la G, las rayas y el punto."""
    x, y = rejilla(S, escala, centrar)
    k = S * escala / D  # pixeles por unidad de diseno
    cov = lambda sd: np.clip(0.5 - sd * k, 0.0, 1.0)
    return cov(_trazo(x, y)), cov(_rayas(x, y)), cov(_punto(x, y))


def _sobre(rgb, a, origen_rgb, origen_a):
    """Compone `origen` encima de `rgb`/`a` (alfa recta, trabajando con arreglos float)."""
    a_sal = origen_a + a * (1 - origen_a)
    seguro = np.where(a_sal > 1e-9, a_sal, 1.0)
    rgb_sal = (origen_rgb * origen_a[..., None] + rgb * (a * (1 - origen_a))[..., None]) / seguro[..., None]
    return rgb_sal, a_sal


def _color(c, S):
    return np.broadcast_to(np.array(c, dtype=np.float64), (S, S, 3))


def _degradado_horizontal(S):
    t = ((np.arange(S) + 0.5) / S)[None, :, None]
    a, b = np.array(INDIGO, dtype=np.float64), np.array(PURPURA, dtype=np.float64)
    return np.broadcast_to(a + (b - a) * t, (S, S, 3)).copy()


# Degradado de la G de color, ajustado sobre el logo «G sobre blanco» (de arriba a la izquierda hacia abajo a la derecha, mas fuerte en x que en y)
GRAD_A, GRAD_B, GRAD_C = 0.000864, 0.000497, -0.4037   # t = A*x + B*y + C en el espacio de diseno (0 = indigo, 1 = purpura)


def _degradado_g(x, y):
    t = np.clip(GRAD_A * x + GRAD_B * y + GRAD_C, 0.0, 1.0)[..., None]
    a, b = np.array(INDIGO, dtype=np.float64), np.array(PURPURA, dtype=np.float64)
    return a + (b - a) * t


def _a_imagen(rgb, a, con_alfa):
    if con_alfa:
        arr = np.dstack([np.clip(rgb, 0, 255), np.clip(a * 255, 0, 255)])
        return Image.fromarray(np.round(arr).astype(np.uint8), 'RGBA')
    return Image.fromarray(np.round(np.clip(rgb, 0, 255)).astype(np.uint8), 'RGB')


def icono(S, escala=1.0, centrar=False):
    """Cuadrado completo con degradado indigo a purpura, G y rayas blancas y punto rojo (icono de la app, sin transparencia)."""
    g, rayas, punto = capas(S, escala, centrar)
    rgb = _degradado_horizontal(S)
    blanco = np.maximum(g, rayas)
    rgb = rgb * (1 - blanco[..., None]) + 255.0 * blanco[..., None]
    rgb = rgb * (1 - punto[..., None]) + np.array(ROJO, dtype=np.float64) * punto[..., None]
    return _a_imagen(rgb, np.ones((S, S)), False)


def fondo_degradado(S):
    return _a_imagen(_degradado_horizontal(S), np.ones((S, S)), False)


def primer_plano_blanco(S, escala, centrar=True):
    """G, rayas y punto sobre fondo transparente (primer plano del icono adaptable de Android, sobre el degradado)."""
    g, rayas, punto = capas(S, escala, centrar)
    rgb, a = _color((255, 255, 255), S).copy(), np.maximum(g, rayas)
    rgb, a = _sobre(rgb, a, _color(ROJO, S), punto)
    return _a_imagen(rgb, a, True)


def logo_color(S, escala=1.0, centrar=True):
    """La G con su degradado, rayas violeta y punto rojo sobre fondo transparente (para fondos claros: pantalla de arranque y web)."""
    g, rayas, punto = capas(S, escala, centrar)
    x, y = rejilla(S, escala, centrar)
    rgb = _degradado_g(x, y)
    a = g.copy()
    rgb, a = _sobre(rgb, a, _color(RAYA_COLOR, S), rayas * RAYA_ALFA)
    rgb, a = _sobre(rgb, a, _color(ROJO, S), punto)
    return _a_imagen(rgb, a, True)


def monocromo(S, escala, centrar=True):
    """Silueta en un solo color (negro) con su alfa, para los iconos tematicos de Android 13."""
    g, rayas, punto = capas(S, escala, centrar)
    a = np.maximum(np.maximum(g, punto), rayas * 0.6)
    return _a_imagen(np.zeros((S, S, 3)), a, True)


# ------------------------------------------------------------------ SVG (mismas medidas)
def _xy_fin():
    return CX + R * math.cos(FIN), CY + R * math.sin(FIN)


def _rayas_svg():
    largo = 2 * math.pi * RD
    raya = largo * RAYA_GRADOS / 360.0
    hueco = largo / RAYAS - raya
    return f'{raya:.2f} {hueco:.2f}'


def svg_g(color_trazo='url(#g)', color_rayas='#6E5AF4', op_rayas=RAYA_ALFA, color_punto='#E30713'):
    xf, yf = _xy_fin()
    return (
        f'<path d="M{CX:g} {BAR_Y:g}H{CX + R:g}V{CY:g}A{R:g} {R:g} 0 1 1 {xf:.1f} {yf:.1f}" fill="none" stroke="{color_trazo}" stroke-width="{W:g}" stroke-linecap="round" stroke-linejoin="round"/>'
        f'<circle cx="{CX:g}" cy="{CY:g}" r="{RD:g}" fill="none" stroke="{color_rayas}" stroke-opacity="{op_rayas}" stroke-width="{WD:g}" stroke-dasharray="{_rayas_svg()}"/>'
        f'<circle cx="{CX:g}" cy="{CY:g}" r="{PUNTO:g}" fill="{color_punto}"/>'
    )


def _vector_gradiente():
    """Extremos (x1,y1)-(x2,y2) del degradado de la G en el espacio de diseno, a partir de t = A*x + B*y + C."""
    n2 = GRAD_A ** 2 + GRAD_B ** 2
    p0 = (-GRAD_C * GRAD_A / n2, -GRAD_C * GRAD_B / n2)
    p1 = ((1 - GRAD_C) * GRAD_A / n2, (1 - GRAD_C) * GRAD_B / n2)
    return p0, p1


def svg_logo_color():
    (x1, y1), (x2, y2) = _vector_gradiente()
    ox, oy = 128, 122  # recorte alrededor de la G (se deja aire)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{ox} {oy} {int(D) - 2 * ox + 22} {int(D) - 2 * oy + 22}" role="img" aria-label="GeoMatrix">'
        f'<defs><linearGradient id="g" gradientUnits="userSpaceOnUse" x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}"><stop stop-color="#4F46E5"/><stop offset="1" stop-color="#7E22CE"/></linearGradient></defs>'
        f'{svg_g()}</svg>'
    )


def svg_icono(redondeo=True):
    """Cuadrado con degradado horizontal y la G blanca (el icono de la app), con esquinas redondeadas para usarlo como favicon o insignia."""
    rx = 'rx="270"' if redondeo else ''
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {int(D)} {int(D)}" role="img" aria-label="GeoMatrix">'
        f'<defs><linearGradient id="f" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#4F46E5"/><stop offset="1" stop-color="#7E22CE"/></linearGradient></defs>'
        f'<rect width="{int(D)}" height="{int(D)}" {rx} fill="url(#f)"/>'
        f'<g transform="translate(-10.5 -4.5)">{svg_g("#fff", "#fff", 1)}</g></svg>'
    )
