import React from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>*{box-sizing:border-box;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#f8fafc;touch-action:none;overscroll-behavior:none}canvas{display:block;width:100%;height:100%;touch-action:none;cursor:crosshair}</style></head><body><canvas id="c"></canvas><script>const c=document.getElementById('c'),x=c.getContext('2d',{alpha:true});let pointer=null,used=false;function size(){const r=Math.max(1,window.devicePixelRatio||1),w=c.clientWidth,h=c.clientHeight;c.width=Math.round(w*r);c.height=Math.round(h*r);x.setTransform(r,0,0,r,0,0);x.lineWidth=2.8;x.lineCap='round';x.lineJoin='round';x.strokeStyle='#071b43'}function point(e){const r=c.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top]}function down(e){if(pointer!==null)return;e.preventDefault();pointer=e.pointerId;used=true;c.setPointerCapture?.(e.pointerId);x.beginPath();x.moveTo(...point(e))}function move(e){if(e.pointerId!==pointer)return;e.preventDefault();const events=e.getCoalescedEvents?e.getCoalescedEvents():[e];for(const item of events){x.lineTo(...point(item))}x.stroke()}function up(e){if(e.pointerId!==pointer)return;e.preventDefault();move(e);try{c.releasePointerCapture?.(e.pointerId)}catch{}pointer=null;if(used)window.ReactNativeWebView.postMessage(c.toDataURL('image/png'))}c.addEventListener('pointerdown',down,{passive:false});c.addEventListener('pointermove',move,{passive:false});c.addEventListener('pointerup',up,{passive:false});c.addEventListener('pointercancel',up,{passive:false});requestAnimationFrame(size);</script></body></html>`;
export default function SignaturePad({
  onChange,
  onDrawingChange,
}: {
  onChange: (value: string) => void;
  onDrawingChange?: (drawing: boolean) => void;
}) {
  return (
    <View style={s.wrap}>
      <WebView
        source={{ html }}
        javaScriptEnabled
        domStorageEnabled={false}
        scrollEnabled={false}
        nestedScrollEnabled={false}
        overScrollMode="never"
        onTouchStart={() => onDrawingChange?.(true)}
        onTouchEnd={() => onDrawingChange?.(false)}
        onTouchCancel={() => onDrawingChange?.(false)}
        onMessage={(event) => {
          onChange(event.nativeEvent.data);
          onDrawingChange?.(false);
        }}
        androidLayerType="hardware"
        bounces={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        style={s.web}
      />
    </View>
  );
}
const s = StyleSheet.create({
  wrap: {
    height: 170,
    borderWidth: 1,
    borderColor: "#D8E0EA",
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#F8FAFC",
  },
  web: { flex: 1, backgroundColor: "#F8FAFC" },
});
