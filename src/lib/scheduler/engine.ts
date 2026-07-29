import type {
  Docente,
  MateriaCatalogo,
  Espacio,
  ReservaExterna,
  SchedulerConfig,
  SchedulerResult,
  UnidadTrabajo,
  Asignacion,
  Conflicto,
  Dia,
  Turno,
  TipoEspacio,
} from "@/types/scheduler";
import { SLOTS, TURNOS_SLOTS, DIAS } from "@/types/scheduler";

// ======================================================================
// ITERATIVE SCHEDULING ENGINE
// Simple iterative algorithm: build work units, sort by difficulty,
// assign greedily with fallbacks. No recursion, no CSP.
// ======================================================================

// --- HELPERS ---

function normalizeStr(s: string): string {
  return s.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
}

function buildStudentGroupKey(carrera: string, semestre: string, grupoCodigo: string): string {
  return normalizeStr(carrera) + "|" + normalizeStr(semestre) + "|" + normalizeStr(grupoCodigo);
}

function inferirTurno(turno: string): Turno {
  const t = turno.toLowerCase();
  if (t.includes("noche") || turno.endsWith("N")) return "Noche";
  if (t.includes("tarde") || turno.endsWith("T")) return "Tarde";
  return "Mañana";
}

function esPracticaLaboral(materia: MateriaCatalogo): boolean {
  const nombre = normalizeStr(materia.nombreAsignatura);
  const codigo = materia.codigo.toUpperCase();
  const keywords = [
    "PRACTICA LABORAL", "PRACTICAS LABORALES", "PRACTICA PROFESIONAL",
    "PASANTIA", "TRABAJO DIRIGIDO", "PROYECTO DE GRADO",
  ];
  return keywords.some((kw) => nombre.includes(kw)) ||
    codigo.startsWith("PRL") || codigo.startsWith("PRP") || codigo.startsWith("PAS");
}

function repartirEnSesiones(horas: number, maxPorSesion: number, tipo: TipoEspacio | null): number[] {
  if (horas <= 0) return [];
  if (horas === 1) horas = 2;

  const minPorSesion = 2;
  const max = Math.max(maxPorSesion, minPorSesion);

  if (horas <= max) return [horas];

  const numSesiones = Math.ceil(horas / max);
  const sesiones: number[] = [];
  let remaining = horas;

  for (let i = 0; i < numSesiones; i++) {
    const left = numSesiones - i;
    const base = Math.floor(remaining / left);
    const thisSession = Math.min(base, max);
    sesiones.push(thisSession);
    remaining -= thisSession;
  }

  // Distribute remainder
  for (let i = 0; i < sesiones.length && remaining > 0; i++) {
    const add = Math.min(remaining, max - sesiones[i]);
    sesiones[i] += add;
    remaining -= add;
  }

  // Ensure no session < 2
  for (let i = 0; i < sesiones.length; i++) {
    if (sesiones[i] < minPorSesion) {
      sesiones[i] = minPorSesion;
    }
  }

  // Sort descending
  sesiones.sort((a, b) => b - a);
  return sesiones;
}

function crearEspacioAIR(): Espacio {
  return { id: -1, codigo: "AIR", tipo: "AULA", aforo: 9999, escuela: 0 };
}

// --- MAIN ENTRY POINT ---

export function ejecutarScheduler(
  docentes: Docente[],
  materias: MateriaCatalogo[],
  espacios: Espacio[],
  reservas: ReservaExterna[],
  config: SchedulerConfig
): SchedulerResult {
  const startTime = Date.now();
  const log: string[] = [];

  // State tracking maps
  const docenteOcupado = new Map<string, boolean>();
  const espacioOcupado = new Map<string, boolean>();
  const estudiantesOcupados = new Map<string, boolean>();
  const grupoCargaDiaria = new Map<string, number>();

  // Pre-index external reservations
  for (const r of reservas) {
    espacioOcupado.set(`${r.espacioId}|${r.dia}|${r.slot}`, true);
  }

  log.push(`[INFO] Docentes: ${docentes.length}, Espacios: ${espacios.length}, Reservas: ${reservas.length}`);

  // Step 1: Build work units
  let materiasActivas = materias.filter((m) => m.horasPorSemana > 0 && m.tipoAula !== null);
  if (config.carrerasAProgramar.length > 0) {
    materiasActivas = materiasActivas.filter((m) =>
      config.carrerasAProgramar.some((c) => m.carrera.toLowerCase().includes(c.toLowerCase()))
    );
  }

  const unidades: UnidadTrabajo[] = materiasActivas.map((materia) => {
    const tipo = materia.tipoAula;
    const maxPorSesion = tipo === "AULA" ? 3 : tipo === "TALLER" ? config.maxPerSesionTaller : config.maxPerSesionLab;
    const sesiones = repartirEnSesiones(materia.horasPorSemana, maxPorSesion, tipo);
    const practica = esPracticaLaboral(materia);

    // Difficulty score
    let dificultad = materia.horasPorSemana * 3;
    if (tipo === "LABORATORIO") dificultad += 35;
    else if (tipo === "TALLER") dificultad += 25;
    const espaciosDisp = espacios.filter((e) => e.tipo === tipo && e.escuela === materia.escuela && e.aforo >= (materia.proyeccionInscritos || 0));
    if (espaciosDisp.length === 0) dificultad += 60;
    else if (espaciosDisp.length === 1) dificultad += 40;
    else if (espaciosDisp.length <= 3) dificultad += 20;
    const docentesDisp = docentes.filter((d) => d.materiasHabilitadas.some((mh) => mh.sigla === materia.codigo));
    if (docentesDisp.length === 0) dificultad += 50;
    else if (docentesDisp.length === 1) dificultad += 30;

    const esPrioritaria = config.docentesPrioritarios.length > 0 && docentes.some(
      (d) => config.docentesPrioritarios.includes(d.ci) && d.materiasHabilitadas.some((mh) => mh.sigla === materia.codigo)
    );

    const grupoKey = materia.carrera + "|" + materia.semestre + "|" + materia.codigo + "|" + materia.grupoCodigo;

    return { materia, sesiones, dificultad, esPrioritaria, esPractica: practica, grupoKey };
  });

  // Step 2: Sort by difficulty (practicas last, priority first, most constrained first)
  unidades.sort((a, b) => {
    if (a.esPractica !== b.esPractica) return a.esPractica ? 1 : -1;
    if (a.esPrioritaria !== b.esPrioritaria) return a.esPrioritaria ? -1 : 1;
    return b.dificultad - a.dificultad;
  });

  log.push(`[FASE 1] ${unidades.length} unidades de trabajo construidas`);

  // Track assignments per group per day for adjacency preference
  const groupDaySlots = new Map<string, number[]>(); // key: studentKey|dia -> sorted slot indices

  const asignaciones: Asignacion[] = [];
  const conflictos: Conflicto[] = [];

  // Helpers for constraint checking
  function isValid(
    docenteId: number | null, espacioId: number | null, studentKey: string,
    dia: Dia, slots: string[], capacidad: number, proyeccion: number,
    tipoEspacio: TipoEspacio | null, materiaEscuela: number,
    espacio: Espacio | null, esAIR: boolean
  ): boolean {
    for (const slot of slots) {
      // HC-01: docente overlap
      if (docenteId !== null && docenteOcupado.has(`${docenteId}|${dia}|${slot}`)) return false;
      // HC-02: space overlap
      if (espacioId !== null && espacioId !== -1 && espacioOcupado.has(`${espacioId}|${dia}|${slot}`)) return false;
      // HC-05: student group overlap
      if (estudiantesOcupados.has(`${studentKey}|${dia}|${slot}`)) return false;
    }
    // HC-06: capacity
    if (!esAIR && capacidad < proyeccion) return false;
    // HC-08: max 7 periods per day per student group
    const currentLoad = grupoCargaDiaria.get(`${studentKey}|${dia}`) || 0;
    if (currentLoad + slots.length > 7) return false;
    // HC-09: space type must match
    if (!esAIR && espacio && tipoEspacio && espacio.tipo !== tipoEspacio) return false;
    // HC-SCHOOL: space school must match
    if (!esAIR && espacio && espacio.escuela !== materiaEscuela && espacio.escuela !== 0) return false;
    return true;
  }

  function applyAssignment(
    docenteId: number | null, espacioId: number | null, studentKey: string,
    dia: Dia, slots: string[]
  ): void {
    for (const slot of slots) {
      if (docenteId !== null) docenteOcupado.set(`${docenteId}|${dia}|${slot}`, true);
      if (espacioId !== null && espacioId !== -1) espacioOcupado.set(`${espacioId}|${dia}|${slot}`, true);
      estudiantesOcupados.set(`${studentKey}|${dia}|${slot}`, true);
    }
    const key = `${studentKey}|${dia}`;
    grupoCargaDiaria.set(key, (grupoCargaDiaria.get(key) || 0) + slots.length);

    // Track for adjacency
    const gdKey = `${studentKey}|${dia}`;
    const existing = groupDaySlots.get(gdKey) || [];
    for (const slot of slots) {
      existing.push(SLOTS.indexOf(slot));
    }
    existing.sort((a, b) => a - b);
    groupDaySlots.set(gdKey, existing);
  }

  function getWindows(nBloques: number, turno: Turno): string[][] {
    const turnoKey = turno as keyof typeof TURNOS_SLOTS;
    const turnoSlots = TURNOS_SLOTS[turnoKey];
    if (!turnoSlots || turnoSlots.length < nBloques) return [];
    const windows: string[][] = [];
    for (let i = 0; i <= turnoSlots.length - nBloques; i++) {
      windows.push(turnoSlots.slice(i, i + nBloques));
    }
    return windows;
  }

  function calcGap(studentKey: string, dia: Dia, windowSlots: string[]): number {
    const gdKey = `${studentKey}|${dia}`;
    const existing = groupDaySlots.get(gdKey);
    if (!existing || existing.length === 0) return 999; // No existing classes, neutral

    const windowIndices = windowSlots.map((s) => SLOTS.indexOf(s));
    const wMin = Math.min(...windowIndices);
    const wMax = Math.max(...windowIndices);
    const eMin = Math.min(...existing);
    const eMax = Math.max(...existing);

    if (wMax < eMin) return eMin - wMax - 1;
    if (wMin > eMax) return wMin - eMax - 1;
    return 0; // overlapping range = adjacent/inside
  }

  function orderWindowsByAdjacency(windows: string[][], studentKey: string, dia: Dia): string[][] {
    return [...windows].sort((a, b) => {
      const gapA = calcGap(studentKey, dia, a);
      const gapB = calcGap(studentKey, dia, b);
      return gapA - gapB;
    });
  }

  function getDaysOrdered(studentKey: string, usedDays: Dia[], materTurno?: Turno): Dia[] {
    // Prefer least loaded days, prefer non-contiguous to already used days
    const diaIndex: Record<string, number> = {
      "Lunes": 0, "Martes": 1, "Miércoles": 2, "Jueves": 3, "Viernes": 4, "Sábado": 5,
    };
    const available = DIAS.filter((d) => {
      if (d === "Sábado") {
        // Only include Saturday if the materia's turno is enabled for Saturday
        if (!materTurno) return config.sabadoManana || config.sabadoTarde || config.sabadoNoche;
        if (materTurno === "Mañana") return config.sabadoManana;
        if (materTurno === "Tarde") return config.sabadoTarde;
        if (materTurno === "Noche") return config.sabadoNoche;
        return false;
      }
      return true;
    });

    return [...available].sort((a, b) => {
      const loadA = grupoCargaDiaria.get(`${studentKey}|${a}`) || 0;
      const loadB = grupoCargaDiaria.get(`${studentKey}|${b}`) || 0;
      if (loadA !== loadB) return loadA - loadB;

      // Prefer non-contiguous to already used days
      if (usedDays.length > 0) {
        const idxA = diaIndex[a] ?? 0;
        const idxB = diaIndex[b] ?? 0;
        const minDistA = Math.min(...usedDays.map((d) => Math.abs(idxA - (diaIndex[d] ?? 0))));
        const minDistB = Math.min(...usedDays.map((d) => Math.abs(idxB - (diaIndex[d] ?? 0))));
        return minDistB - minDistA; // Prefer larger distance
      }
      return 0;
    });
  }

  // Step 3: Iterate and assign
  for (const unidad of unidades) {
    const materia = unidad.materia;
    const studentKey = buildStudentGroupKey(materia.carrera, materia.semestre, materia.grupoCodigo);
    const turno = inferirTurno(materia.turno as string);
    const usedDaysForMateria: Dia[] = [];

    for (let sesIdx = 0; sesIdx < unidad.sesiones.length; sesIdx++) {
      const nBloques = Math.max(unidad.sesiones[sesIdx], 2);
      log.push(`[SESION] ${materia.codigo} (${materia.grupoCodigo}) sesion ${sesIdx}/${unidad.sesiones.length - 1}, bloques: ${nBloques}, turno: ${turno}`);
      const windows = getWindows(nBloques, turno);
      if (windows.length === 0) {
        conflictos.push({
          materiaCodigo: materia.codigo,
          materiaNombre: materia.nombreAsignatura,
          grupoCodigo: materia.grupoCodigo,
          carrera: materia.carrera,
          semestre: materia.semestre,
          sesionIndex: sesIdx,
          motivo: `No hay ventanas de ${nBloques} bloques en turno ${turno}`,
        });
        log.push(`[FAIL] ${materia.codigo} (${materia.grupoCodigo}) sesion ${sesIdx} - sin ventanas en turno ${turno}`);
        continue;
      }

      // Get candidate docentes
      const docentesCand = unidad.esPractica ? [] : docentes.filter((d) =>
        d.materiasHabilitadas.some((mh) => mh.sigla === materia.codigo)
      );

      // Get candidate spaces
      let espaciosCand: Espacio[] = [];
      if (unidad.esPractica) {
        espaciosCand = []; // Will use AIR
      } else {
        // Primary: type + school + capacity
        espaciosCand = espacios.filter((e) =>
          e.tipo === materia.tipoAula && e.escuela === materia.escuela && e.aforo >= (materia.proyeccionInscritos || 0)
        );
        // Fallback: any of correct type (ignore school)
        if (espaciosCand.length === 0) {
          espaciosCand = espacios.filter((e) =>
            e.tipo === materia.tipoAula && e.aforo >= (materia.proyeccionInscritos || 0)
          );
        }
      }

      const days = getDaysOrdered(studentKey, usedDaysForMateria, turno);
      let assigned = false;

      // Attempt 1: Normal (docente + physical space)
      if (!unidad.esPractica && docentesCand.length > 0 && espaciosCand.length > 0) {
        for (const dia of days) {
          if (assigned) break;
          const orderedWindows = orderWindowsByAdjacency(windows, studentKey, dia);
          for (const w of orderedWindows) {
            if (assigned) break;
            for (const doc of docentesCand) {
              // Check docente disponibilidad
              const disponible = w.every((slot) =>
                doc.disponibilidad.some((ds) => ds.dia === dia && ds.slot === slot)
              );
              if (!disponible) continue;

              for (const esp of espaciosCand) {
                if (isValid(doc.id, esp.id, studentKey, dia, w, esp.aforo, materia.proyeccionInscritos || 0, materia.tipoAula, materia.escuela, esp, false)) {
                  applyAssignment(doc.id, esp.id, studentKey, dia, w);
                  asignaciones.push({
                    materiaCodigo: materia.codigo, materiaNombre: materia.nombreAsignatura,
                    grupoCodigo: materia.grupoCodigo, carrera: materia.carrera, semestre: materia.semestre,
                    docenteId: doc.id, docenteNombre: doc.nombre,
                    espacioId: esp.id, espacioCodigo: esp.codigo,
                    dia, slots: w, turno, tipoEspacio: materia.tipoAula,
                    esAIR: false, esSinDocente: false, sesionIndex: sesIdx,
                  });
                  usedDaysForMateria.push(dia);
                  assigned = true;
                  log.push(`[OK] ${materia.codigo} (${materia.grupoCodigo}) S${sesIdx} -> ${dia} ${w[0]}-${w[w.length - 1]} | ${doc.nombre} | ${esp.codigo}`);
                  break;
                }
              }
            }
          }
        }
      }

      // Attempt 2: Sin Docente + physical space
      if (!assigned && !unidad.esPractica && espaciosCand.length > 0) {
        for (const dia of days) {
          if (assigned) break;
          const orderedWindows = orderWindowsByAdjacency(windows, studentKey, dia);
          for (const w of orderedWindows) {
            if (assigned) break;
            for (const esp of espaciosCand) {
              if (isValid(null, esp.id, studentKey, dia, w, esp.aforo, materia.proyeccionInscritos || 0, materia.tipoAula, materia.escuela, esp, false)) {
                applyAssignment(null, esp.id, studentKey, dia, w);
                asignaciones.push({
                  materiaCodigo: materia.codigo, materiaNombre: materia.nombreAsignatura,
                  grupoCodigo: materia.grupoCodigo, carrera: materia.carrera, semestre: materia.semestre,
                  docenteId: null, docenteNombre: "Sin Docente",
                  espacioId: esp.id, espacioCodigo: esp.codigo,
                  dia, slots: w, turno, tipoEspacio: materia.tipoAula,
                  esAIR: false, esSinDocente: true, sesionIndex: sesIdx,
                });
                usedDaysForMateria.push(dia);
                assigned = true;
                log.push(`[OK] ${materia.codigo} (${materia.grupoCodigo}) S${sesIdx} -> ${dia} ${w[0]}-${w[w.length - 1]} | Sin Docente | ${esp.codigo}`);
                break;
              }
            }
          }
        }
      }

      // Attempt 3: Docente + AIR space
      if (!assigned && !unidad.esPractica && docentesCand.length > 0) {
        for (const dia of days) {
          if (assigned) break;
          const orderedWindows = orderWindowsByAdjacency(windows, studentKey, dia);
          for (const w of orderedWindows) {
            if (assigned) break;
            for (const doc of docentesCand) {
              const disponible = w.every((slot) =>
                doc.disponibilidad.some((ds) => ds.dia === dia && ds.slot === slot)
              );
              if (!disponible) continue;
              if (isValid(doc.id, null, studentKey, dia, w, 9999, materia.proyeccionInscritos || 0, materia.tipoAula, materia.escuela, null, true)) {
                applyAssignment(doc.id, null, studentKey, dia, w);
                asignaciones.push({
                  materiaCodigo: materia.codigo, materiaNombre: materia.nombreAsignatura,
                  grupoCodigo: materia.grupoCodigo, carrera: materia.carrera, semestre: materia.semestre,
                  docenteId: doc.id, docenteNombre: doc.nombre,
                  espacioId: null, espacioCodigo: "AIR",
                  dia, slots: w, turno, tipoEspacio: materia.tipoAula,
                  esAIR: true, esSinDocente: false, sesionIndex: sesIdx,
                });
                usedDaysForMateria.push(dia);
                assigned = true;
                log.push(`[OK] ${materia.codigo} (${materia.grupoCodigo}) S${sesIdx} -> ${dia} ${w[0]}-${w[w.length - 1]} | ${doc.nombre} | AIR`);
                break;
              }
            }
          }
        }
      }

      // Attempt 4: AIR + Sin Docente (last resort) or Practica (always AIR)
      if (!assigned) {
        for (const dia of days) {
          if (assigned) break;
          const orderedWindows = orderWindowsByAdjacency(windows, studentKey, dia);
          for (const w of orderedWindows) {
            if (assigned) break;
            if (isValid(null, null, studentKey, dia, w, 9999, materia.proyeccionInscritos || 0, materia.tipoAula, materia.escuela, null, true)) {
              applyAssignment(null, null, studentKey, dia, w);
              asignaciones.push({
                materiaCodigo: materia.codigo, materiaNombre: materia.nombreAsignatura,
                grupoCodigo: materia.grupoCodigo, carrera: materia.carrera, semestre: materia.semestre,
                docenteId: null, docenteNombre: "Sin Docente",
                espacioId: null, espacioCodigo: "AIR",
                dia, slots: w, turno, tipoEspacio: materia.tipoAula,
                esAIR: true, esSinDocente: true, sesionIndex: sesIdx,
              });
              usedDaysForMateria.push(dia);
              assigned = true;
              log.push(`[OK] ${materia.codigo} (${materia.grupoCodigo}) S${sesIdx} -> ${dia} ${w[0]}-${w[w.length - 1]} | Sin Docente | AIR`);
              break;
            }
          }
        }
      }

      // If still not assigned, mark as conflict
      if (!assigned) {
        conflictos.push({
          materiaCodigo: materia.codigo,
          materiaNombre: materia.nombreAsignatura,
          grupoCodigo: materia.grupoCodigo,
          carrera: materia.carrera,
          semestre: materia.semestre,
          sesionIndex: sesIdx,
          motivo: "No se encontro combinacion valida incluso con AIR + Sin Docente",
        });
        log.push(`[FAIL] ${materia.codigo} (${materia.grupoCodigo}) sesion ${sesIdx} - sin combinacion valida`);
      }
    }
  }

  const duracion = Date.now() - startTime;
  log.push(`[FIN] Completado en ${duracion}ms. Asignadas: ${asignaciones.length}, Conflictos: ${conflictos.length}`);

  return {
    asignaciones,
    conflictos,
    totalAsignadas: asignaciones.length,
    totalConflictos: conflictos.length,
    totalAIR: asignaciones.filter((a) => a.esAIR).length,
    totalSinDocente: asignaciones.filter((a) => a.esSinDocente).length,
    duracionMs: duracion,
    log,
  };
}
