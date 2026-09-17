import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Location from "expo-location";
import { WebView } from "react-native-webview";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../AuthContext";
import { C } from "../theme";

const filters = ["TODOS", "CONSUMO", "OTROS"];
const labels: Record<string, string> = {
  TODOS: "Todos", CONSUMO: "Consumo", OTROS: "Otros (MYPE)", YO: "Mi ubicación",
};
const colors: Record<string, string> = {
  CONSUMO: "#2563EB", OTROS: "#F59E0B", YO: "#0B22A1",
};

function normalizePoint(item: any) {
  const expediente = item.expediente || item;
  return {
    id: expediente.id_expediente,
    latitud: Number(expediente.latitud),
    longitud: Number(expediente.longitud),
    nombres: expediente.nombres_cliente,
    distrito: expediente.distrito,
    direccion: expediente.direccion_domicilio,
    telefono: expediente.telefono_cliente,
    codigo: expediente.codigo_expediente,
    monto: expediente.monto_desembolso,
    estado: expediente.tipo_credito || "CONSUMO",
  };
}

function mapHtml(points: any[]) {
  const safePoints = JSON.stringify(
    points.map((point) => ({
      id: point.id,
      lat: Number(point.latitud),
      lng: Number(point.longitud),
      name: point.nombres || "Cliente sin nombre",
      dni: point.codigo || "",
      district: point.distrito || "Sin distrito",
      address: point.direccion || "Dirección no registrada",
      phone: point.telefono || "No registrado",
      debt: Number(point.monto || 0),
      advisor: point.estado === "YO",
      label: labels[point.estado] || point.estado,
      color: colors[point.estado] || "#334155",
    })),
  ).replace(/</g, "\\u003c");

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><link rel="preconnect" href="https://tile.openstreetmap.org" crossorigin><style>
html,body,#map{width:100%;height:100%;margin:0;overflow:hidden;background:#eaf1f8;font-family:Arial,sans-serif;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
#tiles,#marks{position:absolute;inset:0}.tile{position:absolute;width:256px;height:256px;background:#dbe7f3;will-change:transform}.mark{position:absolute;width:48px;height:58px;border:0;background:transparent;transform:translate(-24px,-49px);padding:10px 11px;z-index:5}.pin{display:block;width:24px;height:24px;border:2px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 6px #071b435c}.pin:after{content:'';display:block;width:6px;height:6px;border-radius:50%;background:#fff;margin:7px}.advisor-pin{position:relative;display:flex;width:38px;height:38px;margin:-7px;align-items:center;justify-content:center;border:3px solid #fff;border-radius:50%;background:linear-gradient(145deg,#0B22A1,#2563EB);color:#fff;box-shadow:0 4px 12px #071b4375}.advisor-pin:before{content:'';position:absolute;inset:-7px;border:2px solid #38BDF8;border-radius:50%;opacity:.75;animation:advisorPulse 1.8s ease-out infinite}.advisor-pin svg{position:relative;width:21px;height:21px;fill:#fff}@keyframes advisorPulse{0%{transform:scale(.8);opacity:.85}75%,100%{transform:scale(1.35);opacity:0}}.controls{position:absolute;right:12px;top:12px;display:grid;gap:3px;z-index:20}.controls button{width:44px;height:44px;border:1px solid #dbe2ea;background:#fff;color:#071b43;font-size:24px;font-weight:bold;border-radius:10px;box-shadow:0 4px 14px #071b4320}.attr{position:absolute;right:3px;bottom:2px;padding:2px 4px;background:#ffffffdd;color:#475569;font-size:8px;z-index:10}.info{display:none;position:absolute;left:12px;right:12px;bottom:18px;padding:14px 42px 14px 14px;background:#fff;border:1px solid #dbe4ee;border-radius:16px;box-shadow:0 8px 30px #071b4340;z-index:30}.info b{display:block;color:#172033;font-size:14px;line-height:18px;margin-bottom:5px}.meta{color:#64748b;font-size:11px;line-height:16px}.debt{margin-top:7px;color:#071b43;font-size:12px;font-weight:800}.tag{display:inline-block;margin-top:8px;padding:4px 8px;border-radius:999px;color:#fff;font-size:10px;font-weight:800}.close{position:absolute;right:8px;top:8px;width:30px;height:30px;border:0;border-radius:10px;background:#f1f5f9;color:#475569;font-size:20px}.loading{position:absolute;left:12px;top:12px;background:#ffffffee;border-radius:12px;padding:8px 10px;color:#475569;font-size:11px;font-weight:700;z-index:9}
</style></head><body><div id="map"><div id="tiles"></div><div id="marks"></div><div class="controls"><button id="zin">+</button><button id="zout">−</button></div><div id="loading" class="loading">Cargando mapa...</div><div id="info" class="info"></div><div class="attr">© OpenStreetMap</div></div><script>
let points=${safePoints};const tileHost='https://tile.openstreetmap.org';const tileSize=256;let zoom=points.length?14:11;let center=points.length?fitCenter(points):{lat:-12.0653,lng:-75.2049};let dragging=false,last=null,pinchStart=null,shiftX=0,shiftY=0,zoomTimer=0,tapMark=null,tapStart=null;const tiles=document.getElementById('tiles'),marks=document.getElementById('marks'),info=document.getElementById('info'),loading=document.getElementById('loading');
function clamp(v,min,max){return Math.max(min,Math.min(max,v))}function scale(z){return tileSize*Math.pow(2,z)}function project(lat,lng,z=zoom){const s=scale(z),sin=Math.sin(lat*Math.PI/180),x=(lng+180)/360*s,y=(0.5-Math.log((1+sin)/(1-sin))/(4*Math.PI))*s;return{x,y}}function unproject(x,y,z=zoom){const s=scale(z),lng=x/s*360-180,n=Math.PI-2*Math.PI*y/s,lat=180/Math.PI*Math.atan(0.5*(Math.exp(n)-Math.exp(-n)));return{lat,lng}}function fitCenter(list){const lat=list.reduce((a,p)=>a+p.lat,0)/list.length,lng=list.reduce((a,p)=>a+p.lng,0)/list.length;return{lat,lng}}function viewport(){return{w:window.innerWidth,h:window.innerHeight}}function centerPx(){return project(center.lat,center.lng)}function screenFromLatLng(lat,lng){const p=project(lat,lng),c=centerPx(),v=viewport();return{x:p.x-c.x+v.w/2,y:p.y-c.y+v.h/2}}function setCenterFromScreenDelta(dx,dy){const c=centerPx();center=unproject(c.x-dx,c.y-dy)}
function resetLayers(){tiles.style.transition='none';marks.style.transition='none';tiles.style.transform='';marks.style.transform='';shiftX=0;shiftY=0}function draw(){resetLayers();drawTiles();drawMarks();loading.style.display='none'}function drawTiles(){const v=viewport(),tileZoom=Math.ceil(zoom),factor=Math.pow(2,zoom-tileZoom),c=project(center.lat,center.lng,tileZoom),logicalW=v.w/factor,logicalH=v.h/factor,startX=c.x-logicalW/2,startY=c.y-logicalH/2,minX=Math.floor(startX/tileSize)-1,maxX=Math.floor((startX+logicalW)/tileSize)+1,minY=Math.floor(startY/tileSize)-1,maxY=Math.floor((startY+logicalH)/tileSize)+1,maxTile=Math.pow(2,tileZoom);let html='';for(let x=minX;x<=maxX;x++){for(let y=minY;y<=maxY;y++){if(y<0||y>=maxTile)continue;const tx=((x%maxTile)+maxTile)%maxTile,left=(x*tileSize-startX)*factor,top=(y*tileSize-startY)*factor,size=tileSize*factor;html+=\`<img class="tile" src="\${tileHost}/\${tileZoom}/\${tx}/\${y}.png" style="width:\${size}px;height:\${size}px;transform:translate3d(\${left}px,\${top}px,0)" draggable="false">\`;}}tiles.innerHTML=html}function drawMarks(){marks.innerHTML=points.map((p,i)=>{const s=screenFromLatLng(p.lat,p.lng),marker=p.advisor?\`<span class="advisor-pin"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z"/></svg></span>\`:\`<span class="pin" style="background:\${p.color}"></span>\`;return \`<button class="mark" data-i="\${i}" aria-label="\${p.advisor?'Mi ubicación':'Ubicación de '+p.name}" style="left:\${s.x}px;top:\${s.y}px">\${marker}</button>\`;}).join('')}function animateLayersTo(value,origin,done){tiles.style.transformOrigin=origin;marks.style.transformOrigin=origin;tiles.style.transition='transform 150ms cubic-bezier(.22,.72,.18,1)';marks.style.transition='transform 150ms cubic-bezier(.22,.72,.18,1)';requestAnimationFrame(()=>{tiles.style.transform='scale('+value+')';marks.style.transform='scale('+value+')'});clearTimeout(zoomTimer);zoomTimer=setTimeout(done,155)}function setZoom(next,cx=innerWidth/2,cy=innerHeight/2,animate=true){next=clamp(next,3,19);if(Math.abs(next-zoom)<.0001){if(animate)animateLayersTo(1,cx+'px '+cy+'px',draw);else draw();return}const previous=zoom,before=centerPx(),worldBefore={x:before.x+(cx-innerWidth/2),y:before.y+(cy-innerHeight/2)},geo=unproject(worldBefore.x,worldBefore.y,zoom);zoom=next;const p=project(geo.lat,geo.lng,zoom),newCenter={x:p.x-(cx-innerWidth/2),y:p.y-(cy-innerHeight/2)};center=unproject(newCenter.x,newCenter.y,zoom);if(!animate){draw();return}animateLayersTo(Math.pow(2,zoom-previous),cx+'px '+cy+'px',draw)}function previewPinch(totalRatio,m){if(!pinchStart)return;const value=clamp(totalRatio,.35,3),origin=m.x+'px '+m.y+'px';tiles.style.transition='none';marks.style.transition='none';tiles.style.transformOrigin=origin;marks.style.transformOrigin=origin;tiles.style.transform='scale('+value+')';marks.style.transform='scale('+value+')';pinchStart.ratio=value;pinchStart.m=m}function commitPinch(){if(!pinchStart)return;const state=pinchStart,next=clamp(state.z+Math.log2(state.ratio||1),3,19);pinchStart=null;setZoom(next,state.m.x,state.m.y,false)}function pan(dx,dy){setCenterFromScreenDelta(dx,dy);shiftX+=dx;shiftY+=dy;tiles.style.transform='translate3d('+shiftX+'px,'+shiftY+'px,0)';marks.style.transform='translate3d('+shiftX+'px,'+shiftY+'px,0)'}function endPan(){if(!dragging)return;dragging=false;last=null;draw()}function distance(t){const dx=t[0].clientX-t[1].clientX,dy=t[0].clientY-t[1].clientY;return Math.sqrt(dx*dx+dy*dy)}function midpoint(t){return{x:(t[0].clientX+t[1].clientX)/2,y:(t[0].clientY+t[1].clientY)/2}}
function h(v){return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}function hideInfo(){info.style.display='none'}function showInfo(index){const p=points[Number(index)];if(!p)return;const debt=Number(p.debt||0);info.innerHTML=\`<button class="close" aria-label="Cerrar">×</button><b>\${h(p.name)}</b><div class="meta">Expediente \${h(p.dni||'-')} · \${h(p.district)}<br>\${h(p.address)}<br>Teléfono: \${h(p.phone)}</div>\${debt>0?\`<div class="debt">Monto desembolsado: S/ \${debt.toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>\`:''}<span class="tag" style="background:\${p.color}">\${h(p.label)}</span>\`;info.style.display='block';info.querySelector('.close').onclick=e=>{e.stopPropagation();hideInfo()}}info.addEventListener('touchstart',e=>{e.stopPropagation()},{passive:false});info.addEventListener('touchmove',e=>{e.stopPropagation()},{passive:false});info.addEventListener('touchend',e=>{const close=e.target.closest('.close');if(close){hideInfo();e.preventDefault()}e.stopPropagation()},{passive:false});info.addEventListener('touchcancel',e=>{e.stopPropagation()},{passive:false});
document.getElementById('zin').onclick=()=>setZoom(zoom+1);document.getElementById('zout').onclick=()=>setZoom(zoom-1);marks.addEventListener('click',e=>{const b=e.target.closest('.mark');if(b)showInfo(b.dataset.i)});document.addEventListener('touchstart',e=>{const b=e.target.closest('.mark');tapMark=b;tapStart=e.touches.length===1?{x:e.touches[0].clientX,y:e.touches[0].clientY}:null;if(!b&&!e.target.closest('.info'))hideInfo();if(e.touches.length===2){tapMark=null;if(dragging)endPan();pinchStart={d:distance(e.touches),z:zoom,m:midpoint(e.touches),ratio:1}}else if(e.touches.length===1&&!pinchStart){dragging=true;last={x:e.touches[0].clientX,y:e.touches[0].clientY}}e.preventDefault()},{passive:false});document.addEventListener('touchmove',e=>{if(tapMark&&tapStart&&e.touches.length===1){const dx=e.touches[0].clientX-tapStart.x,dy=e.touches[0].clientY-tapStart.y;if(Math.hypot(dx,dy)>8)tapMark=null}if(e.touches.length===2&&pinchStart){tapMark=null;previewPinch(distance(e.touches)/pinchStart.d,midpoint(e.touches))}else if(dragging&&e.touches.length===1){const p={x:e.touches[0].clientX,y:e.touches[0].clientY};pan(p.x-last.x,p.y-last.y);last=p}e.preventDefault()},{passive:false});document.addEventListener('touchend',e=>{const selectedMark=tapMark;tapMark=null;tapStart=null;if(e.touches.length<2&&pinchStart)commitPinch();if(e.touches.length===0)endPan();if(selectedMark)showInfo(selectedMark.dataset.i)},{passive:false});document.addEventListener('touchcancel',()=>{tapMark=null;tapStart=null;commitPinch();endPan()},{passive:false});document.addEventListener('mousedown',e=>{dragging=true;last={x:e.clientX,y:e.clientY};if(!e.target.closest('.mark')&&!e.target.closest('.info'))hideInfo()});document.addEventListener('mousemove',e=>{if(!dragging)return;pan(e.clientX-last.x,e.clientY-last.y);last={x:e.clientX,y:e.clientY}});document.addEventListener('mouseup',endPan);document.addEventListener('wheel',e=>{hideInfo();setZoom(zoom+(e.deltaY<0?1:-1),e.clientX,e.clientY);e.preventDefault()},{passive:false});window.centerRadar=(lat,lng)=>{hideInfo();center={lat:Number(lat),lng:Number(lng)};zoom=Math.max(zoom,16);draw()};window.addEventListener('resize',draw);draw();
window.updateAdvisor=(payload)=>{points=points.filter(point=>!point.advisor);if(payload&&Number.isFinite(Number(payload.lat))&&Number.isFinite(Number(payload.lng)))points.push(payload);drawMarks()};
</script></body></html>`;
}

export default function MapScreen({ refreshRevision = 0, currentLocation }: { refreshRevision?: number; currentLocation?: { latitude: number; longitude: number; accuracy: number | null } | null }) {
  const { api } = useAuth();
  const insets = useSafeAreaInsets();
  const web = useRef<WebView>(null);
  const [filter, setFilter] = useState("TODOS");
  const [all, setAll] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const points = useMemo(
    () => all.filter((point) => filter === "TODOS" || point.estado === filter),
    [all, filter],
  );
  const html = useMemo(() => mapHtml(points), [points]);
  const advisorPayload = useMemo(() => currentLocation ? {
    id: "self",
    lat: currentLocation.latitude,
    lng: currentLocation.longitude,
    name: "Mi ubicación en tiempo real",
    dni: "",
    district: "GPS del dispositivo",
    address: currentLocation.accuracy ? `Precisión aproximada: ${Math.round(currentLocation.accuracy)} m` : "Ubicación activa",
    phone: "",
    debt: 0,
    advisor: true,
    label: labels.YO,
    color: colors.YO,
  } : null, [currentLocation]);
  const syncAdvisor = useCallback(() => {
    web.current?.injectJavaScript(`window.updateAdvisor&&window.updateAdvisor(${JSON.stringify(advisorPayload)});true;`);
  }, [advisorPayload]);

  useEffect(() => { syncAdvisor(); }, [syncAdvisor]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setError("");
      const response: any = await api("/api/asignaciones/mias");
      const next = (response.data || [])
        .map(normalizePoint)
        .filter((point: any) => Number.isFinite(point.latitud) && Number.isFinite(point.longitud));
      setAll(next);
    } catch (e: any) {
      setError(e.message || "No se pudo cargar el mapa.");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [load]);
  useEffect(() => { if (refreshRevision > 0) load(); }, [refreshRevision, load]);

  const center = async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") throw new Error("Permite la ubicación para centrar el mapa.");
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      web.current?.injectJavaScript(`window.centerRadar(${current.coords.latitude},${current.coords.longitude});true;`);
    } catch (e: any) {
      Alert.alert("Ubicación no disponible", e.message);
    }
  };

  return (
    <View style={s.root}>
      <View style={[s.header, { paddingTop: Math.max(insets.top + 10, 24) }]}>
        <View style={s.head}>
          <View style={s.headText}>
            <Text style={s.title}>Mapa de mi muestra</Text>
            <Text style={s.sub}>{points.length} expediente(s) · OpenStreetMap</Text>
          </View>
          <View style={[s.live, error ? s.liveError : null]}>
            <View style={[s.dot, error ? { backgroundColor: C.red } : null]} />
            <Text style={[s.liveText, error ? { color: C.red } : null]}>
              {loading ? "Actualizando" : error ? "Sin conexión" : "En línea"}
            </Text>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>
          {filters.map((item) => (
            <Pressable key={item} onPress={() => setFilter(item)} style={[s.chip, filter === item ? s.chipOn : null]}>
              <View style={[s.chipDot, { backgroundColor: item === "TODOS" ? "#94A3B8" : colors[item] }]} />
              <Text style={[s.chipText, filter === item ? s.chipTextOn : null]}>{labels[item]}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <WebView
        ref={web}
        originWhitelist={["*"]}
        source={{ html }}
        javaScriptEnabled
        domStorageEnabled={false}
        cacheEnabled
        cacheMode="LOAD_CACHE_ELSE_NETWORK"
        scrollEnabled={false}
        nestedScrollEnabled={false}
        overScrollMode="never"
        setBuiltInZoomControls={false}
        setDisplayZoomControls={false}
        androidLayerType="hardware"
        onLoadEnd={syncAdvisor}
        style={s.map}
      />

      <Pressable onPress={center} style={s.gps}>
        <MaterialCommunityIcons name="crosshairs-gps" size={24} color={C.primary} />
      </Pressable>

      {!loading && points.length === 0 ? (
        <View style={s.empty}>
          <MaterialCommunityIcons name="map-marker-off-outline" size={34} color={C.primary} />
          <Text style={s.emptyTitle}>Sin expedientes ubicados</Text>
          <Text style={s.emptyText}>{error || "No hay coordenadas disponibles para este filtro."}</Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#EAF1F8" },
  header: { backgroundColor: "#fff", paddingHorizontal: 16, paddingBottom: 12, gap: 11, borderBottomWidth: 1, borderBottomColor: C.border, zIndex: 2 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  headText: { flex: 1 },
  title: { fontSize: 24, fontWeight: "900", color: C.text },
  sub: { fontSize: 11, color: C.muted, marginTop: 3 },
  live: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#EAFBF5", paddingHorizontal: 9, paddingVertical: 6, borderRadius: 14 },
  liveError: { backgroundColor: "#FEE2E2" },
  dot: { width: 6, height: 6, borderRadius: 6, backgroundColor: C.success },
  liveText: { fontSize: 9, fontWeight: "900", color: C.success },
  filters: { gap: 7, paddingRight: 10 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 18, backgroundColor: "#F1F4F8" },
  chipOn: { backgroundColor: C.primary },
  chipDot: { width: 6, height: 6, borderRadius: 6 },
  chipText: { fontSize: 10, fontWeight: "800", color: C.text },
  chipTextOn: { color: "#fff" },
  map: { flex: 1, backgroundColor: "#EAF1F8" },
  gps: { position: "absolute", right: 14, bottom: 42, width: 48, height: 48, borderRadius: 16, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", elevation: 7, shadowColor: "#071B43", shadowOpacity: 0.16, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  empty: { position: "absolute", top: "48%", left: 24, right: 24, alignItems: "center", gap: 6, backgroundColor: "#FFFFFFF2", borderRadius: 18, padding: 18, elevation: 5 },
  emptyTitle: { fontSize: 14, fontWeight: "900", color: C.text },
  emptyText: { fontSize: 11, lineHeight: 16, textAlign: "center", color: C.muted },
});
