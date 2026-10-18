// La empresa del auditor (nombre y marca) la dice el servidor al entrar: nadie la elige. Se guarda en el celular para mostrarla sin señal.
import { useEffect, useState } from "react";
import { cacheGet, cacheSet } from "./offlineSync";

export type EmpresaApp = { id: string; nombre: string; marca?: { nombre?: string; producto?: string; color?: string } };
const CLAVE = "empresa_v1";
let enMemoria: EmpresaApp | null = null;
const oyentes = new Set<(e: EmpresaApp | null) => void>();

export async function recordarEmpresa(empresa: EmpresaApp | null) {
  enMemoria = empresa;
  oyentes.forEach((f) => f(empresa));
  await cacheSet(CLAVE, empresa);
}

export function useEmpresa(api?: <T>(path: string) => Promise<T>) {
  const [empresa, setEmpresa] = useState<EmpresaApp | null>(enMemoria);
  useEffect(() => {
    oyentes.add(setEmpresa);
    if (!enMemoria) cacheGet<EmpresaApp>(CLAVE).then((c) => { if (c?.value && !enMemoria) { enMemoria = c.value; setEmpresa(c.value); } });
    if (api) api<any>("/api/visitas/config").then((r) => { if (r?.data?.empresa) recordarEmpresa(r.data.empresa); }).catch(() => {});
    return () => { oyentes.delete(setEmpresa); };
  }, [api]);
  return empresa;
}

export const nombreDeEmpresa = (e: EmpresaApp | null) => e?.marca?.nombre || e?.nombre || "";
