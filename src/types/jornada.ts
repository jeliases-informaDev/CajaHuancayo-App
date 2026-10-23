// Lo que el celular manda al servidor al iniciar la jornada de campo: dónde está en ese momento y, si pudo averiguarlo, el nombre del distrito, la provincia y
// el departamento. Eso es la «zona de trabajo» del auditor: ya no se escribe a mano en el panel. Todo es opcional (sin GPS a tiempo, la jornada igual empieza).
export type ZonaJornada = {
  latitud?: number;
  longitud?: number;
  precision?: number;
  simulada?: boolean;
  distrito?: string;
  provincia?: string;
  departamento?: string;
};
