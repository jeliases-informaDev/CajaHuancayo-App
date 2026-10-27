"""Genera los iconos de GeoMatrix para la app (Expo) y para la web a partir de la geometria de logo_geomatrix.py.
uso: python -I generar_logos.py <raiz de CajaHuancayo-App> <raiz de CajaHuancayo-Web> <carpeta de vista previa>
"""
import os, sys
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import logo_geomatrix as L

app, web, vista = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(vista, exist_ok=True)

# El primer plano del icono adaptable de Android ocupa el 56 % del lienzo: la zona segura es el 61 % central y la mascara circular deja ver el 67 %.
ESCALA_ADAPTABLE = 0.56 * L.D / 1007.0   # 1007 = diametro de la G en el espacio de diseno


def guardar(img, ruta):
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    img.save(ruta, 'PNG', optimize=True)
    print('  ', ruta.replace('\\', '/').split('/CajaHuancayo-')[-1], img.size, img.mode, os.path.getsize(ruta) // 1024, 'KB')


print('APP')
guardar(L.icono(1024, 1.0, True), f'{app}/assets/icon.png')
guardar(L.primer_plano_blanco(1024, ESCALA_ADAPTABLE), f'{app}/assets/android-icon-foreground.png')
guardar(L.fondo_degradado(1024), f'{app}/assets/android-icon-background.png')
guardar(L.monocromo(1024, ESCALA_ADAPTABLE), f'{app}/assets/android-icon-monochrome.png')
guardar(L.logo_color(1024, 0.9, True), f'{app}/assets/splash-icon.png')
guardar(L.icono(196, 1.0, True), f'{app}/assets/favicon.png')

print('WEB')
carpeta = f'{web}/public/marca/geomatrix'
os.makedirs(carpeta, exist_ok=True)
for nombre, svg in (('logo.svg', L.svg_logo_color()),):
    with open(f'{carpeta}/{nombre}', 'w', encoding='utf-8', newline='\n') as f:
        f.write(svg + '\n')
    print('  ', f'public/marca/geomatrix/{nombre}', len(svg), 'bytes')
with open(f'{web}/public/favicon.svg', 'w', encoding='utf-8', newline='\n') as f:
    f.write(L.svg_icono(True) + '\n')
print('   public/favicon.svg')


def redondeado(img, radio_rel=0.215):
    """Icono cuadrado con esquinas redondeadas y transparencia (para la web)."""
    s = img.size[0]
    mascara = Image.new('L', (s * 4, s * 4), 0)
    ImageDraw.Draw(mascara).rounded_rectangle([0, 0, s * 4 - 1, s * 4 - 1], radius=int(s * 4 * radio_rel), fill=255)
    mascara = mascara.resize((s, s), Image.LANCZOS)
    salida = img.convert('RGBA')
    salida.putalpha(mascara)
    return salida


guardar(redondeado(L.icono(512, 1.0, True)), f'{carpeta}/icono-512.png')
guardar(redondeado(L.icono(48, 1.0, True)), f'{web}/public/favicon-48.png')
guardar(L.icono(180, 1.0, True), f'{web}/public/apple-touch-icon.png')   # iOS pone su propia mascara: sin transparencia

# ---------------------------------------------------------------- vista previa
def circulo(img):
    s = img.size[0]
    m = Image.new('L', (s * 4, s * 4), 0)
    ImageDraw.Draw(m).ellipse([0, 0, s * 4 - 1, s * 4 - 1], fill=255)
    out = img.convert('RGBA'); out.putalpha(m.resize((s, s), Image.LANCZOS)); return out


def adaptable(S, forma):
    fondo = L.fondo_degradado(S).convert('RGBA')
    fondo.alpha_composite(L.primer_plano_blanco(S, ESCALA_ADAPTABLE))
    # la zona visible del icono adaptable es el 72/108 central
    caja = int(S * 18 / 108)
    visible = fondo.crop((caja, caja, S - caja, S - caja)).resize((S, S), Image.LANCZOS)
    return circulo(visible) if forma == 'circulo' else redondeado(visible, 0.3)


S = 400
hoja = Image.new('RGBA', (S * 5 + 60, S + 40), (238, 240, 248, 255))
elementos = [
    redondeado(L.icono(S, 1.0, True), 0.225),                 # iOS
    adaptable(S, 'circulo'),                                  # Android, mascara circular
    adaptable(S, 'cuadrada'),                                 # Android, mascara redondeada
    Image.alpha_composite(Image.new('RGBA', (S, S), (255, 255, 255, 255)), L.logo_color(S, 0.9, True)),   # pantalla de arranque
    Image.alpha_composite(Image.new('RGBA', (S, S), (60, 60, 70, 255)), Image.merge('RGBA', (Image.new('L', (S, S), 235),) * 3 + (L.monocromo(S, ESCALA_ADAPTABLE).split()[3],))),  # tematico (alfa teñido)
]
for i, im in enumerate(elementos):
    hoja.alpha_composite(im.resize((S, S)), (20 + i * (S + 5), 20))
hoja.convert('RGB').save(f'{vista}/vista_previa_app.png')
print('vista previa:', f'{vista}/vista_previa_app.png')
