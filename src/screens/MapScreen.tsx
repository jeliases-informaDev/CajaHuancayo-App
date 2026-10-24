import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Linking,
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
import { C, conMayusculas, estadoDeCaso, FI, N } from "../theme";
import CarruselCasos, { ordenarPorCercania, type CasoCarrusel } from "../components/CarruselCasos";
import GeoFilterBar, { GEO_FILTRO_TODOS, GeoFiltro, matchesGeoFiltro } from "../components/GeoFilterBar";
import { cargarMuestra } from "../muestra";

const filters = ["TODOS", "CONSUMO", "OTROS"];
const labels: Record<string, string> = {
  TODOS: "Todos", CONSUMO: "Consumo", OTROS: "Otros (MYPE)", YO: "Mi ubicación",
};
const colors: Record<string, string> = {
  CONSUMO: "#2563EB", OTROS: "#F59E0B", YO: "#0B22A1",
};
const RUTA_COLOR = "#0ead7a";

const LEJOS_M = 60_000;
function distanciaMetros(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(toRad(lat2 - lat1) / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lng2 - lng1) / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
const fmtDistancia = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`);

function normalizePoint(item: any) {
  const expediente = item.expediente || item;
  return {
    id: expediente.id_expediente,
    latitud: Number(expediente.latitud),
    longitud: Number(expediente.longitud),
    nombres: expediente.nombres_cliente,
    distrito: expediente.distrito,
    provincia: expediente.provincia,
    departamento: expediente.departamento,
    direccion: expediente.direccion_domicilio,
    telefono: expediente.telefono_cliente,
    codigo: expediente.codigo_expediente,
    monto: expediente.monto_desembolso,
    moneda: expediente.moneda,
    asesor: expediente.asesor_responsable,
    prioridad: String(item.prioridad || "MEDIA").toUpperCase(),
    estado: expediente.tipo_credito || "CONSUMO",
    estadoAsignacion: item.estado,
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
      currency: point.moneda || "",
      advisorName: point.asesor || "",
      priority: point.prioridad || "MEDIA",
      advisor: point.estado === "YO",
      disponible: !!point.disponible,
      label: labels[point.estado] || point.estado,
      color: colors[point.estado] || "#334155",
    })),
  ).replace(/</g, "\\u003c");

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><link rel="preconnect" href="https://tile.openstreetmap.org" crossorigin><style>
html,body,#map{width:100%;height:100%;margin:0;overflow:hidden;background:#eaf1f8;font-family:Arial,sans-serif;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
#tiles,#lines,#marks{position:absolute;inset:0}#lines{pointer-events:none}.tile{position:absolute;width:256px;height:256px;background:#dbe7f3;will-change:transform}.mark{position:absolute;width:40px;height:40px;border:0;background:transparent;transform:translate(-20px,-20px);z-index:5;display:flex;align-items:center;justify-content:center}.stop{display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:#0ead7a;border:2px solid #fff;box-shadow:0 2px 6px #071b435c;color:#fff;font-weight:800;font-size:11px}.dot{display:block;width:13px;height:13px;border-radius:50%;background:#334155;border:2px solid #fff;box-shadow:0 0 0 1px #33415566}.advisor-pin{position:relative;display:flex;width:38px;height:38px;align-items:center;justify-content:center;border:3px solid #fff;border-radius:50%;background:linear-gradient(145deg,#0B22A1,#2563EB);color:#fff;box-shadow:0 4px 12px #071b4375}.advisor-pin:before{content:'';position:absolute;inset:-7px;border:2px solid #38BDF8;border-radius:50%;opacity:.75;animation:advisorPulse 1.8s ease-out infinite}.advisor-pin svg{position:relative;width:21px;height:21px;fill:#fff}@keyframes advisorPulse{0%{transform:scale(.8);opacity:.85}75%,100%{transform:scale(1.35);opacity:0}}.controls{position:absolute;right:12px;top:12px;display:grid;gap:0;z-index:20;background:#fff;border-radius:14px;box-shadow:0 4px 14px #071b4320;overflow:hidden}.controls button{width:46px;height:46px;border:0;background:#fff;color:#4757B8;font-size:28px;font-weight:400;border-radius:0}.controls button+button{border-top:1px solid #E4E7EE}.attr{position:absolute;right:3px;bottom:2px;padding:2px 4px;background:#ffffffdd;color:#475569;font-size:8px;z-index:10}.info{display:none;position:absolute;left:12px;right:12px;bottom:18px;padding:14px 42px 14px 14px;background:#fff;border:1px solid #dbe4ee;border-radius:16px;box-shadow:0 8px 30px #071b4340;z-index:30}.info b{display:block;color:#172033;font-size:14px;line-height:18px;margin-bottom:5px}.meta{color:#64748b;font-size:11px;line-height:16px}.debt{margin-top:7px;color:#071b43;font-size:12px;font-weight:800}.tag{display:inline-block;margin-top:8px;padding:4px 8px;border-radius:999px;color:#fff;font-size:10px;font-weight:800}.go{display:inline-flex;align-items:center;gap:5px;margin-top:10px;margin-left:8px;padding:7px 12px;border-radius:10px;border:0;background:#1236c7;color:#fff;font-size:11px;font-weight:800}.chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px}.chip{display:inline-block;padding:3px 9px;border-radius:999px;font-size:10px;font-weight:800}.clu{display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px #071b4360;color:#fff;font-weight:800;font-size:13px}.ghost{background:#eef2ff!important;color:#1236c7!important}.close{position:absolute;right:8px;top:8px;width:30px;height:30px;border:0;border-radius:10px;background:#f1f5f9;color:#475569;font-size:20px}.loading{position:absolute;left:12px;top:12px;background:#ffffffee;border-radius:12px;padding:8px 10px;color:#475569;font-size:11px;font-weight:700;z-index:9}
</style></head><body><div id="map"><div id="tiles"></div><svg id="lines"></svg><div id="marks"></div><div class="controls"><button id="zin">+</button><button id="zout">−</button></div><div id="loading" class="loading">Cargando mapa...</div><div id="info" class="info"></div><div class="attr">© OpenStreetMap</div></div><script>
let points=${safePoints};const tileHost='https://tile.openstreetmap.org';const tileSize=256;let zoom=points.length?14:11;let center=points.length?fitCenter(points):{lat:-12.0464,lng:-77.0428};let dragging=false,last=null,pinchStart=null,shiftX=0,shiftY=0,zoomTimer=0,tapMark=null,tapStart=null,draggingAdvisor=false,advisorEl=null;const tiles=document.getElementById('tiles'),lines=document.getElementById('lines'),marks=document.getElementById('marks'),info=document.getElementById('info'),loading=document.getElementById('loading');
function clamp(v,min,max){return Math.max(min,Math.min(max,v))}function scale(z){return tileSize*Math.pow(2,z)}function project(lat,lng,z=zoom){const s=scale(z),sin=Math.sin(lat*Math.PI/180),x=(lng+180)/360*s,y=(0.5-Math.log((1+sin)/(1-sin))/(4*Math.PI))*s;return{x,y}}function unproject(x,y,z=zoom){const s=scale(z),lng=x/s*360-180,n=Math.PI-2*Math.PI*y/s,lat=180/Math.PI*Math.atan(0.5*(Math.exp(n)-Math.exp(-n)));return{lat,lng}}function fitCenter(list){const lat=list.reduce((a,p)=>a+p.lat,0)/list.length,lng=list.reduce((a,p)=>a+p.lng,0)/list.length;return{lat,lng}}function viewport(){return{w:window.innerWidth,h:window.innerHeight}}function centerPx(){return project(center.lat,center.lng)}function screenFromLatLng(lat,lng){const p=project(lat,lng),c=centerPx(),v=viewport();return{x:p.x-c.x+v.w/2,y:p.y-c.y+v.h/2}}function latLngFromScreen(sx,sy){const c=centerPx(),v=viewport();return unproject(sx-v.w/2+c.x,sy-v.h/2+c.y)}function setCenterFromScreenDelta(dx,dy){const c=centerPx();center=unproject(c.x-dx,c.y-dy)}
function resetLayers(){tiles.style.transition='none';lines.style.transition='none';marks.style.transition='none';tiles.style.transform='';lines.style.transform='';marks.style.transform='';shiftX=0;shiftY=0}function draw(){resetLayers();drawTiles();drawMarks();drawLines();loading.style.display='none'}function haversine(aLat,aLng,bLat,bLng){const R=6371000,toRad=d=>d*Math.PI/180,dLat=toRad(bLat-aLat),dLng=toRad(bLng-aLng),a=Math.sin(dLat/2)**2+Math.cos(toRad(aLat))*Math.cos(toRad(bLat))*Math.sin(dLng/2)**2;return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))}function computeRoute(){const advisor=points.find(p=>p.advisor),candidates=points.filter(p=>!p.advisor&&!p.disponible);candidates.forEach(p=>{p.order=null;p.distFromAdvisor=null});if(!advisor||!candidates.length)return;let restantes=candidates.slice(),actual={lat:advisor.lat,lng:advisor.lng},n=1;while(restantes.length){let idxMin=0,distMin=Infinity;restantes.forEach((p,i)=>{const d=haversine(actual.lat,actual.lng,p.lat,p.lng);if(d<distMin){distMin=d;idxMin=i}});const next=restantes.splice(idxMin,1)[0];next.order=n++;next.distFromAdvisor=haversine(advisor.lat,advisor.lng,next.lat,next.lng);actual=next}}function fmtDist(m){return m<1000?Math.round(m)+' m':(m/1000).toFixed(2)+' km'}function drawLines(){drawRouteLine();addGeofence()}function addGeofence(){if(selected===null||!points[selected])return;const p=points[selected],sc=screenFromLatLng(p.lat,p.lng),mpp=40075016.686*Math.cos(p.lat*Math.PI/180)/(tileSize*Math.pow(2,zoom)),r=100/mpp,c=PRIO[p.priority]||'#334155';lines.innerHTML=lines.innerHTML+'<circle cx="'+sc.x+'" cy="'+sc.y+'" r="'+r+'" fill="'+c+'" fill-opacity=".10" stroke="'+c+'" stroke-width="1.5" stroke-dasharray="4 4"/>'}function drawRouteLine(){const advisor=points.find(p=>p.advisor);if(!advisor){lines.innerHTML='';return}const stops=points.filter(p=>!p.advisor&&!p.disponible&&p.order!=null).sort((a,b)=>a.order-b.order);if(!stops.length){lines.innerHTML='';return}const coords=[screenFromLatLng(advisor.lat,advisor.lng),...stops.map(p=>screenFromLatLng(p.lat,p.lng))],pts=coords.map(c=>c.x+','+c.y).join(' ');lines.innerHTML=\`<polyline points="\${pts}" fill="none" stroke="#0ead7a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>\`}function drawTiles(){const v=viewport(),tileZoom=Math.ceil(zoom),factor=Math.pow(2,zoom-tileZoom),c=project(center.lat,center.lng,tileZoom),logicalW=v.w/factor,logicalH=v.h/factor,startX=c.x-logicalW/2,startY=c.y-logicalH/2,minX=Math.floor(startX/tileSize)-1,maxX=Math.floor((startX+logicalW)/tileSize)+1,minY=Math.floor(startY/tileSize)-1,maxY=Math.floor((startY+logicalH)/tileSize)+1,maxTile=Math.pow(2,tileZoom);let html='';for(let x=minX;x<=maxX;x++){for(let y=minY;y<=maxY;y++){if(y<0||y>=maxTile)continue;const tx=((x%maxTile)+maxTile)%maxTile,left=(x*tileSize-startX)*factor,top=(y*tileSize-startY)*factor,size=tileSize*factor;html+=\`<img class="tile" src="\${tileHost}/\${tileZoom}/\${tx}/\${y}.png" style="width:\${size}px;height:\${size}px;transform:translate3d(\${left}px,\${top}px,0)" draggable="false">\`;}}tiles.innerHTML=html}function drawMarks(){
computeRoute();
const items=points.map((p,i)=>({p,i,s:screenFromLatLng(p.lat,p.lng)}));
const v=viewport();const grupos=[];const sueltos=[];
if(zoom<17){items.forEach(it=>{
if(it.p.advisor||it.s.x<-60||it.s.y<-60||it.s.x>v.w+60||it.s.y>v.h+60){sueltos.push(it);return}
const g=grupos.find(g=>Math.hypot(g.x-it.s.x,g.y-it.s.y)<38);
if(g){g.items.push(it);const n=g.items.length;g.x=(g.x*(n-1)+it.s.x)/n;g.y=(g.y*(n-1)+it.s.y)/n}else grupos.push({x:it.s.x,y:it.s.y,items:[it]})})}else items.forEach(it=>sueltos.push(it));
let html='';
grupos.forEach(g=>{if(g.items.length===1){sueltos.push(g.items[0]);return}
const prios=g.items.map(it=>it.p.priority);const color=prios.includes('ALTA')?PRIO.ALTA:prios.includes('MEDIA')?PRIO.MEDIA:'#2563EB';
html+='<button class="mark" data-c="'+g.items.map(it=>it.i).join(',')+'" aria-label="'+g.items.length+' casos agrupados" style="left:'+g.x+'px;top:'+g.y+'px"><span class="clu" style="background:'+color+'">'+g.items.length+'</span></button>'});
const celdas={};sueltos.forEach(it=>{if(it.p.advisor)return;const k=Math.round(it.s.x/7)+'|'+Math.round(it.s.y/7);(celdas[k]=celdas[k]||[]).push(it)});
Object.keys(celdas).forEach(k=>{const g=celdas[k];if(g.length<2)return;const r=15+g.length*2;g.forEach((it,n)=>{const a=2*Math.PI*n/g.length;it.s={x:it.s.x+r*Math.cos(a),y:it.s.y+r*Math.sin(a)}})});
sueltos.forEach(it=>{const p=it.p;let marker;
if(p.advisor)marker='<span class="advisor-pin"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z"/></svg></span>';
else if(p.disponible)marker='<span class="dot"></span>';
else marker='<span class="stop">'+(p.order==null?'':p.order)+'</span>';
html+='<button class="mark" data-i="'+it.i+'" aria-label="'+(p.advisor?'Mi ubicación':'Ubicación de '+h(p.name))+'" style="left:'+it.s.x+'px;top:'+it.s.y+'px">'+marker+'</button>'});
marks.innerHTML=html}
function animateLayersTo(value,origin,done){tiles.style.transformOrigin=origin;lines.style.transformOrigin=origin;marks.style.transformOrigin=origin;tiles.style.transition='transform 150ms cubic-bezier(.22,.72,.18,1)';lines.style.transition='transform 150ms cubic-bezier(.22,.72,.18,1)';marks.style.transition='transform 150ms cubic-bezier(.22,.72,.18,1)';requestAnimationFrame(()=>{tiles.style.transform='scale('+value+')';lines.style.transform='scale('+value+')';marks.style.transform='scale('+value+')'});clearTimeout(zoomTimer);zoomTimer=setTimeout(done,155)}function setZoom(next,cx=innerWidth/2,cy=innerHeight/2,animate=true){next=clamp(next,3,19);if(Math.abs(next-zoom)<.0001){if(animate)animateLayersTo(1,cx+'px '+cy+'px',draw);else draw();return}const previous=zoom,before=centerPx(),worldBefore={x:before.x+(cx-innerWidth/2),y:before.y+(cy-innerHeight/2)},geo=unproject(worldBefore.x,worldBefore.y,zoom);zoom=next;const p=project(geo.lat,geo.lng,zoom),newCenter={x:p.x-(cx-innerWidth/2),y:p.y-(cy-innerHeight/2)};center=unproject(newCenter.x,newCenter.y,zoom);if(!animate){draw();return}animateLayersTo(Math.pow(2,zoom-previous),cx+'px '+cy+'px',draw)}function previewPinch(totalRatio,m){if(!pinchStart)return;const value=clamp(totalRatio,.35,3),origin=m.x+'px '+m.y+'px';tiles.style.transition='none';lines.style.transition='none';marks.style.transition='none';tiles.style.transformOrigin=origin;lines.style.transformOrigin=origin;marks.style.transformOrigin=origin;tiles.style.transform='scale('+value+')';lines.style.transform='scale('+value+')';marks.style.transform='scale('+value+')';pinchStart.ratio=value;pinchStart.m=m}function commitPinch(){if(!pinchStart)return;const state=pinchStart,next=clamp(state.z+Math.log2(state.ratio||1),3,19);pinchStart=null;setZoom(next,state.m.x,state.m.y,false)}function pan(dx,dy){setCenterFromScreenDelta(dx,dy);shiftX+=dx;shiftY+=dy;tiles.style.transform='translate3d('+shiftX+'px,'+shiftY+'px,0)';lines.style.transform='translate3d('+shiftX+'px,'+shiftY+'px,0)';marks.style.transform='translate3d('+shiftX+'px,'+shiftY+'px,0)'}function endPan(){if(!dragging)return;dragging=false;last=null;draw()}function distance(t){const dx=t[0].clientX-t[1].clientX,dy=t[0].clientY-t[1].clientY;return Math.sqrt(dx*dx+dy*dy)}function midpoint(t){return{x:(t[0].clientX+t[1].clientX)/2,y:(t[0].clientY+t[1].clientY)/2}}
function h(v){return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}let selected=null;const PRIO={ALTA:'#ef4444',MEDIA:'#f59e0b',BAJA:'#6d788a'};
function hideInfo(){info.style.display='none';if(selected!==null){selected=null;drawLines()}}
function chipHtml(t,c){return '<span class="chip" style="background:'+c+'22;color:'+c+'">'+t+'</span>'}
function tapMarca(b){if(b.dataset.c)showCluster(b.dataset.c.split(',').map(Number));else showInfo(b.dataset.i)}
function showInfo(index){const p=points[Number(index)];if(!p)return;selected=p.advisor?null:Number(index);
const debt=Number(p.debt||0),advisor=points.find(q=>q.advisor),dist=!p.advisor&&advisor?haversine(advisor.lat,advisor.lng,p.lat,p.lng):null,pc=PRIO[p.priority]||'#334155',tel=p.phone&&p.phone!=='No registrado'&&!p.advisor;
let html='<button class="close" aria-label="Cerrar">×</button><b>'+(p.order?p.order+'. ':'')+h(p.name)+'</b>';
html+='<div class="meta">Expediente '+h(p.dni||'-')+' · '+h(p.district)+'<br>'+h(p.address)+(tel?'<br>Teléfono: '+h(p.phone):'')+'</div>';
if(!p.advisor)html+='<div class="chips">'+chipHtml(h(p.label),p.color)+chipHtml('Prioridad '+h(String(p.priority||'MEDIA').toLowerCase()),pc)+(p.disponible?chipHtml('Fuera del filtro','#64748b'):'')+'</div>';
if(debt>0)html+='<div class="debt">Desembolso: '+(p.currency==='USD'?'US$ ':'S/ ')+debt.toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2})+'</div>';
if(p.advisorName&&!p.advisor)html+='<div class="meta" style="margin-top:4px">Asesor: '+h(p.advisorName)+'</div>';
if(dist!=null)html+='<div class="debt" style="color:#1236c7">'+fmtDist(dist)+' desde ti</div>';
if(p.advisor)html+=p.simulado?'<div class="meta" style="color:#1236c7;margin-top:4px">Punto de partida simulado — arrastra para moverlo</div>':'<div class="meta" style="color:#94a3b8;margin-top:4px">Arrastra este pin para planificar desde otro punto</div>';
if(!p.advisor)html+='<button class="go">Cómo llegar</button>'+(tel?'<button class="go ghost">Llamar</button>':'');
info.innerHTML=html;info.style.display='block';
info.querySelector('.close').onclick=e=>{e.stopPropagation();hideInfo()};
const goBtn=info.querySelector('.go');if(goBtn)goBtn.onclick=e=>{e.stopPropagation();window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:'directions',lat:p.lat,lng:p.lng}))};
const callBtn=info.querySelector('.ghost');if(callBtn)callBtn.onclick=e=>{e.stopPropagation();window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:'call',phone:p.phone}))};
drawLines()}
function showCluster(ids){const list=ids.map(i=>points[i]).filter(Boolean);if(!list.length)return;selected=null;
const cuenta={};list.forEach(q=>{const k=q.priority||'MEDIA';cuenta[k]=(cuenta[k]||0)+1});
let chips='';['ALTA','MEDIA','BAJA'].forEach(k=>{if(cuenta[k])chips+=chipHtml(cuenta[k]+' '+k.toLowerCase(),PRIO[k])});
const nombres=list.slice(0,4).map(q=>'• '+h(q.name)).join('<br>')+(list.length>4?'<br>y '+(list.length-4)+' más':'');
info.innerHTML='<button class="close" aria-label="Cerrar">×</button><b>'+list.length+' casos en este punto</b><div class="chips">'+chips+'</div><div class="meta" style="margin-top:6px">'+nombres+'</div><button class="go">Acercar para verlos</button>';
info.style.display='block';
info.querySelector('.close').onclick=e=>{e.stopPropagation();hideInfo()};
info.querySelector('.go').onclick=e=>{e.stopPropagation();hideInfo();fitList(list)};
drawLines()}
function fitList(list){if(!list.length)return;let a=90,b=-90,c=180,d=-180;list.forEach(q=>{a=Math.min(a,q.lat);b=Math.max(b,q.lat);c=Math.min(c,q.lng);d=Math.max(d,q.lng)});
center={lat:(a+b)/2,lng:(c+d)/2};const vp=viewport();let z=18;for(;z>3;z--){const p1=project(a,c,z),p2=project(b,d,z);if(Math.abs(p2.x-p1.x)<vp.w-90&&Math.abs(p2.y-p1.y)<vp.h-190)break}zoom=Math.min(z,17);draw()}
function nearList(){const adv=points.find(p=>p.advisor),base=adv||points.find(p=>!p.advisor);if(!base)return[];return points.filter(p=>p.advisor||haversine(base.lat,base.lng,p.lat,p.lng)<=60000)}
function autoFit(){const l=nearList();if(l.length)fitList(l)}
window.fitAll=()=>{hideInfo();fitList(points)};
info.addEventListener('touchstart',e=>{e.stopPropagation()},{passive:false});info.addEventListener('touchmove',e=>{e.stopPropagation()},{passive:false});info.addEventListener('touchend',e=>{const close=e.target.closest('.close');if(close){hideInfo();e.preventDefault()}e.stopPropagation()},{passive:false});info.addEventListener('touchcancel',e=>{e.stopPropagation()},{passive:false});
document.getElementById('zin').onclick=()=>setZoom(zoom+1);document.getElementById('zout').onclick=()=>setZoom(zoom-1);marks.addEventListener('click',e=>{const b=e.target.closest('.mark');if(b)tapMarca(b)});document.addEventListener('touchstart',e=>{const b=e.target.closest('.mark');tapMark=b;tapStart=e.touches.length===1?{x:e.touches[0].clientX,y:e.touches[0].clientY}:null;if(!b&&!e.target.closest('.info'))hideInfo();const idx=b?Number(b.dataset.i):-1,isAdvisor=idx>=0&&points[idx]&&points[idx].advisor;if(e.touches.length===2){tapMark=null;draggingAdvisor=false;advisorEl=null;if(dragging)endPan();pinchStart={d:distance(e.touches),z:zoom,m:midpoint(e.touches),ratio:1}}else if(e.touches.length===1&&!pinchStart){if(isAdvisor){draggingAdvisor=true;advisorEl=b}else{dragging=true;last={x:e.touches[0].clientX,y:e.touches[0].clientY}}}e.preventDefault()},{passive:false});document.addEventListener('touchmove',e=>{if(tapMark&&tapStart&&e.touches.length===1){const dx=e.touches[0].clientX-tapStart.x,dy=e.touches[0].clientY-tapStart.y;if(Math.hypot(dx,dy)>8)tapMark=null}if(e.touches.length===2&&pinchStart){tapMark=null;draggingAdvisor=false;advisorEl=null;previewPinch(distance(e.touches)/pinchStart.d,midpoint(e.touches))}else if(draggingAdvisor&&e.touches.length===1&&advisorEl){const t=e.touches[0];advisorEl.style.left=t.clientX+'px';advisorEl.style.top=t.clientY+'px'}else if(dragging&&e.touches.length===1){const p={x:e.touches[0].clientX,y:e.touches[0].clientY};pan(p.x-last.x,p.y-last.y);last=p}e.preventDefault()},{passive:false});document.addEventListener('touchend',e=>{const selectedMark=tapMark;tapMark=null;tapStart=null;if(e.touches.length<2&&pinchStart)commitPinch();if(draggingAdvisor){const el=advisorEl;draggingAdvisor=false;advisorEl=null;if(el&&!selectedMark){const geo=latLngFromScreen(parseFloat(el.style.left),parseFloat(el.style.top)),advisor=points.find(p=>p.advisor);if(advisor){advisor.lat=geo.lat;advisor.lng=geo.lng;advisor.simulado=true;window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:'advisor_moved'}))}drawMarks();drawLines()}else if(selectedMark){tapMarca(selectedMark)}return}if(e.touches.length===0)endPan();if(selectedMark)tapMarca(selectedMark)},{passive:false});document.addEventListener('touchcancel',()=>{tapMark=null;tapStart=null;if(draggingAdvisor){draggingAdvisor=false;advisorEl=null;drawMarks();drawLines()}commitPinch();endPan()},{passive:false});document.addEventListener('mousedown',e=>{dragging=true;last={x:e.clientX,y:e.clientY};if(!e.target.closest('.mark')&&!e.target.closest('.info'))hideInfo()});document.addEventListener('mousemove',e=>{if(!dragging)return;pan(e.clientX-last.x,e.clientY-last.y);last={x:e.clientX,y:e.clientY}});document.addEventListener('mouseup',endPan);document.addEventListener('wheel',e=>{hideInfo();setZoom(zoom+(e.deltaY<0?1:-1),e.clientX,e.clientY);e.preventDefault()},{passive:false});window.centerRadar=(lat,lng)=>{hideInfo();center={lat:Number(lat),lng:Number(lng)};zoom=Math.max(zoom,16);draw()};window.addEventListener('resize',draw);if(points.length)autoFit();else draw();
window.updateAdvisor=(payload)=>{const tenia=points.some(point=>point.advisor);points=points.filter(point=>!point.advisor);if(payload&&Number.isFinite(Number(payload.lat))&&Number.isFinite(Number(payload.lng)))points.push(payload);if(!tenia&&payload&&performance.now()<20000)autoFit();else{drawMarks();drawLines()}};
</script></body></html>`;
}

export default function MapScreen({ refreshRevision = 0, currentLocation }: { refreshRevision?: number; currentLocation?: { latitude: number; longitude: number; accuracy: number | null } | null }) {
  const { api } = useAuth();
  const insets = useSafeAreaInsets();
  const web = useRef<WebView>(null);
  const [filter, setFilter] = useState("TODOS");
  const [geoFiltro, setGeoFiltro] = useState<GeoFiltro>(GEO_FILTRO_TODOS);
  const [all, setAll] = useState<any[]>([]);
  const ultimaCarga = useRef<any[] | null>(null);
  const [incompleto, setIncompleto] = useState<{ cargados: number; total: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const points = useMemo(
    () => all.filter((point) => filter === "TODOS" || point.estado === filter),
    [all, filter],
  );
  const puntosConDistrito = useMemo(
    () => points.map((p) => ({ ...p, disponible: !matchesGeoFiltro(p, geoFiltro) })),
    [points, geoFiltro],
  );
  const enRutaCount = puntosConDistrito.filter((p) => !p.disponible).length;
  // Resumen para el auditor: siguiente caso (el más cercano) y largo de la ruta si los visita de uno en uno, siempre al más cercano.
  const resumen = useMemo(() => {
    const casos = puntosConDistrito.filter((p) => !p.disponible);
    if (!currentLocation || !casos.length) return { casos: casos.length, siguiente: null as any, rutaM: 0, lejanos: 0 };
    let actual = { latitud: currentLocation.latitude, longitud: currentLocation.longitude };
    const restantes = [...casos];
    let siguiente: any = null; let rutaM = 0;
    while (restantes.length) {
      let idx = 0; let dMin = Infinity;
      restantes.forEach((p, i) => { const d = distanciaMetros(actual.latitud, actual.longitud, p.latitud, p.longitud); if (d < dMin) { dMin = d; idx = i; } });
      const [p] = restantes.splice(idx, 1);
      if (!siguiente) siguiente = { nombres: p.nombres, distancia: distanciaMetros(currentLocation.latitude, currentLocation.longitude, p.latitud, p.longitud) };
      rutaM += dMin; actual = p;
    }
    const lejanos = casos.filter((p) => distanciaMetros(currentLocation.latitude, currentLocation.longitude, p.latitud, p.longitud) > LEJOS_M).length;
    return { casos: casos.length, siguiente, rutaM, lejanos };
  }, [puntosConDistrito, currentLocation]);
  const disponibleCount = puntosConDistrito.length - enRutaCount;
  const casosCarrusel = useMemo<CasoCarrusel[]>(() => ordenarPorCercania(currentLocation, puntosConDistrito.filter((p) => !p.disponible)).map((p) => ({
    id: p.id, nombres: p.nombres, codigo: p.codigo, direccion: p.direccion, departamento: p.departamento, distrito: p.distrito,
    tipo: p.estado, prioridad: p.prioridad, estadoTexto: p.estadoAsignacion ? estadoDeCaso(p.estadoAsignacion) : undefined, latitud: p.latitud, longitud: p.longitud,
  })), [puntosConDistrito, currentLocation]);
  const departamentos = useMemo(() => Array.from(new Set(points.map((p) => conMayusculas(p.departamento)).filter(Boolean))), [points]);
  const centrarEnCaso = (caso: CasoCarrusel) => { web.current?.injectJavaScript(`window.centerRadar&&window.centerRadar(${caso.latitud},${caso.longitud});true;`); };
  const html = useMemo(() => mapHtml(puntosConDistrito), [puntosConDistrito]);
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
  // Mientras el pin de inicio está arrastrado a un punto simulado, no lo pisamos con
  // cada actualización real del GPS — solo se sincroniza de nuevo al restablecer.
  const [simulado, setSimulado] = useState(false);
  const [verFiltros, setVerFiltros] = useState(false);
  useEffect(() => { if (!simulado) syncAdvisor(); }, [syncAdvisor, simulado]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setError("");
      // Por páginas y en versión ligera; si la muestra no cambió se devuelve la misma lista y el mapa no se vuelve a armar.
      const m = await cargarMuestra(api, { ligero: true });
      setIncompleto(m.completa ? null : { cargados: m.data.length, total: m.total });
      if (ultimaCarga.current !== m.data) {
        ultimaCarga.current = m.data;
        setAll(m.data
          .map(normalizePoint)
          .filter((point: any) => Number.isFinite(point.latitud) && Number.isFinite(point.longitud)));
      }
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

  const verTodo = () => { web.current?.injectJavaScript("window.fitAll&&window.fitAll();true;"); };

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
            <View style={s.tituloFila}>
              <MaterialCommunityIcons name="folder-outline" size={26} color="#000" />
              <Text style={s.title} accessibilityRole="header">Mapa de mi muestra</Text>
            </View>
            <Text style={s.sub}>
              {puntosConDistrito.length} {puntosConDistrito.length === 1 ? "caso" : "casos"}{departamentos.length === 1 ? ` · Clientes en ${departamentos[0]}` : departamentos.length > 1 ? ` · Clientes en ${departamentos.length} departamentos` : ""}
              {loading ? " · Actualizando…" : error ? " · Sin conexión" : ""}
            </Text>
          </View>
          <Pressable onPress={() => setVerFiltros((v) => !v)} accessibilityRole="button" accessibilityLabel="Filtros del mapa" accessibilityState={{ expanded: verFiltros }} style={[s.filtrosBtn, verFiltros && s.filtrosBtnOn]}>
            <MaterialCommunityIcons name="tune-variant" size={22} color={verFiltros ? "#fff" : N.marca} />
          </Pressable>
        </View>
        <View style={[s.filtrosPanel, !verFiltros && { display: "none" }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>
              {filters.map((item) => (
                <Pressable key={item} onPress={() => setFilter(item)} style={[s.chip, filter === item ? s.chipOn : null]}>
                  <View style={[s.chipDot, { backgroundColor: item === "TODOS" ? "#94A3B8" : colors[item] }]} />
                  <Text style={[s.chipText, filter === item ? s.chipTextOn : null]}>{labels[item]}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <GeoFilterBar items={points} onChange={setGeoFiltro} />
            {points.length ? (
              <View style={s.resumen}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={s.resumenTitulo}>{resumen.casos} {resumen.casos === 1 ? "caso" : "casos"} en tu muestra</Text>
                  {resumen.siguiente ? (
                    <Text style={s.resumenTexto}>Siguiente: <Text style={s.negrita}>{resumen.siguiente.nombres}</Text> · {fmtDistancia(resumen.siguiente.distancia)}{resumen.rutaM > 0 ? ` · ruta de ${fmtDistancia(resumen.rutaM)}` : ""}</Text>
                  ) : null}
                  {resumen.lejanos > 0 ? <Text style={s.resumenApagado}>{resumen.lejanos} {resumen.lejanos === 1 ? "caso está" : "casos están"} a más de 60 km de ti</Text> : null}
                  {incompleto ? <Text style={s.resumenApagado}>Mostrando {incompleto.cargados} de {incompleto.total} casos: acércate a una zona para verlos todos</Text> : null}
                </View>
                <Pressable onPress={verTodo} style={s.verTodo}><Text style={s.verTodoTxt}>Ver todo</Text></Pressable>
              </View>
            ) : null}
            {simulado ? (
              <View style={s.simBanner}>
                <Text style={s.simText}>Ruta simulada desde un punto manual.</Text>
                <Pressable onPress={() => setSimulado(false)}>
                  <Text style={s.simReset}>Usar ubicación en vivo</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        <CarruselCasos casos={casosCarrusel} onCambio={centrarEnCaso} />
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
        onMessage={(event) => {
          try {
            const payload = JSON.parse(event.nativeEvent.data);
            if (payload?.type === "directions" && Number.isFinite(payload.lat) && Number.isFinite(payload.lng)) {
              const origin = currentLocation ? `&origin=${currentLocation.latitude},${currentLocation.longitude}` : "";
              Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${payload.lat},${payload.lng}${origin}`);
            } else if (payload?.type === "call" && payload.phone) {
              Linking.openURL(`tel:${String(payload.phone).replace(/\s/g, "")}`);
            } else if (payload?.type === "advisor_moved") {
              setSimulado(true);
            }
          } catch {}
        }}
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
  header: { backgroundColor: N.fondo, paddingHorizontal: 16, paddingBottom: 12, gap: 12, zIndex: 2 },
  tituloFila: { flexDirection: "row", alignItems: "center", gap: 8 },
  filtrosBtn: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: N.borde, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  filtrosBtnOn: { backgroundColor: N.marca, borderColor: N.marca },
  filtrosPanel: { backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: N.borde, padding: 12, gap: 10 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  headText: { flex: 1 },
  title: { fontFamily: FI.bold, fontSize: 24, lineHeight: 30, color: "#000" },
  sub: { fontFamily: FI.reg, fontSize: 14, color: N.apagado, marginTop: 2 },
  live: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#EAFBF5", paddingHorizontal: 9, paddingVertical: 6, borderRadius: 14 },
  liveError: { backgroundColor: "#FEE2E2" },
  dot: { width: 6, height: 6, borderRadius: 6, backgroundColor: C.success },
  liveText: { fontSize: 9, fontFamily: FI.semi, color: C.success },
  filters: { gap: 7, paddingRight: 10 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 18, backgroundColor: "#F1F4F8" },
  chipOn: { backgroundColor: C.primary },
  chipDot: { width: 6, height: 6, borderRadius: 6 },
  chipText: { fontSize: 10, fontFamily: FI.semi, color: C.text },
  chipTextOn: { color: "#fff" },
  resumen: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#F4F7FF", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  resumenTitulo: { fontSize: 12, fontFamily: FI.semi, color: C.text },
  resumenTexto: { fontFamily: FI.reg, fontSize: 11, color: C.text, lineHeight: 15 },
  resumenApagado: { fontFamily: FI.reg, fontSize: 10.5, color: C.muted },
  negrita: { fontFamily: FI.semi },
  verTodo: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: "#E6ECFF" },
  verTodoTxt: { fontSize: 11, fontFamily: FI.semi, color: "#1236C7" },
  simBanner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, backgroundColor: "#EAF1FF", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  simText: { fontFamily: FI.reg, fontSize: 11, color: C.text, flexShrink: 1 },
  simReset: { fontSize: 11, fontFamily: FI.semi, color: "#1236C7" },
  map: { flex: 1, backgroundColor: "#EAF1F8" },
  gps: { position: "absolute", right: 14, bottom: 42, width: 48, height: 48, borderRadius: 16, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", elevation: 7, shadowColor: "#071B43", shadowOpacity: 0.16, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  empty: { position: "absolute", top: "48%", left: 24, right: 24, alignItems: "center", gap: 6, backgroundColor: "#FFFFFFF2", borderRadius: 18, padding: 18, elevation: 5 },
  emptyTitle: { fontSize: 14, fontFamily: FI.semi, color: C.text },
  emptyText: { fontFamily: FI.reg, fontSize: 11, lineHeight: 16, textAlign: "center", color: C.muted },
});
