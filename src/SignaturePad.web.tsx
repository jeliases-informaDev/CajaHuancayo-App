import React, { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";

// Solo para ver la ficha en el navegador (pruebas): el celular usa SignaturePad.tsx con WebView.
// Mismo contrato: devuelve un PNG en base64 cuando se levanta el dedo/mouse.
export default function SignaturePad({ onChange, onDrawingChange }: { onChange: (value: string) => void; onDrawingChange?: (drawing: boolean) => void }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const x = c.getContext("2d")!;
    const r = Math.max(1, window.devicePixelRatio || 1);
    c.width = Math.round(c.clientWidth * r); c.height = Math.round(c.clientHeight * r);
    x.setTransform(r, 0, 0, r, 0, 0); x.lineWidth = 2.8; x.lineCap = "round"; x.lineJoin = "round"; x.strokeStyle = "#071b43";
    let dibujando = false;
    const p = (e: PointerEvent): [number, number] => { const b = c.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
    const abajo = (e: PointerEvent) => { dibujando = true; onDrawingChange?.(true); c.setPointerCapture?.(e.pointerId); x.beginPath(); x.moveTo(...p(e)); };
    const mover = (e: PointerEvent) => { if (!dibujando) return; x.lineTo(...p(e)); x.stroke(); };
    const arriba = () => { if (!dibujando) return; dibujando = false; onDrawingChange?.(false); onChange(c.toDataURL("image/png")); };
    c.addEventListener("pointerdown", abajo); c.addEventListener("pointermove", mover); c.addEventListener("pointerup", arriba); c.addEventListener("pointercancel", arriba);
    return () => { c.removeEventListener("pointerdown", abajo); c.removeEventListener("pointermove", mover); c.removeEventListener("pointerup", arriba); c.removeEventListener("pointercancel", arriba); };
  }, [onChange, onDrawingChange]);
  return <View style={s.wrap}><canvas ref={ref} style={{ width: "100%", height: "100%", touchAction: "none", cursor: "crosshair", display: "block" }} /></View>;
}
const s = StyleSheet.create({ wrap: { height: 170, borderWidth: 1, borderColor: "#D8E0EA", borderRadius: 14, overflow: "hidden", backgroundColor: "#F8FAFC" } });
