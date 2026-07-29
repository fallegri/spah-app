import type {
  Docente,
  MateriaCatalogo,
  Espacio,
  ReservaExterna,
  SchedulerConfig,
  SchedulerResult,
  Asignacion,
  Conflicto,
  Dia,
  Turno,
} from "@/types/scheduler";
import {
  buildStudentGroupKey,
  inferirTurno,
  buildWorkUnits,
  createOccupancyState,
  isValid,
  applyAssignment,
  getWindows,
  orderWindowsByAdjacency,
  getDaysOrdered,
  getCandidateDocentes,
  getCandidateEspacios,
  isDocenteDisponible,
} from "./shared";
import { ejecutarGreedy } from "./greedy";
import { ejecutarGenetico } from "./genetico";

// ======================================================================
// SCHEDULER DISPATCHER + ITERATIVE ALGORITHM
// ======================================================================

/**
 * Main entry point. Dispatches to the appropriate algorithm based on
 * config.algoritmo. Defaults to iterative if not specified.
 */
export function ejecutarScheduler(
  docentes: Docente[],
  materias: MateriaCatalogo[],
  espacios: Espacio[],
  reservas: ReservaExterna[],
  config: SchedulerConfig
): SchedulerResult {
  const algoritmo = config.algoritmo || "iterativo";

  switch (algoritmo) {
    case "greedy":
      return ejecutarGreedy(docentes, materias, espacios, reservas, config);
    case "genetico":
      return ejecutarGenetico(docentes, materias, espacios, reservas, config);
    case "iterativo":
    default:
      return ejecutarIterativo(docentes, materias, espacios, reservas, config);
  }
}

// ======================================================================
// ITERATIVE ALGORITHM
// Simple iterative: build work units, sort by difficulty,
// assign greedily with fallbacks (first valid match). No recursion.
// ======================================================================

function ejecutarIterativo(
  docentes: Docente[],
  materias: MateriaCatalogo[],
  espacios: Espacio[],
  reservas: ReservaExterna[],
  config: SchedulerConfig
): SchedulerResult {
  const startTime = Date.now();
  const log: string[] = [];

  const state = createOccupancyState(reservas);

  log.push(`[INFO] Docentes: ${docentes.length}, Espacios: ${espacios.length}, Reservas: ${reservas.length}`);

  // Step 1: Build work units
  const unidades = buildWorkUnits(materias, espacios, docentes, config);
  log.push(`[FASE 1] ${unidades.length} unidades de trabajo construidas`);

  const asignaciones: Asignacion[] = [];
  const conflictos: Conflicto[] = [];

  // Step 2: Iterate and assign
  for (const unidad of unidades) {
    const materia = unidad.materia;
    const studentKey = buildStudentGroupKey(materia.carrera, materia.semestre, materia.grupoCodigo);
    const turno = inferirTurno(materia.turno as string);
    const usedDaysForMateria: Dia[] = [];

    const docentesCand = getCandidateDocentes(unidad, docentes);
    const espaciosCand = getCandidateEspacios(unidad, espacios);

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

      const days = getDaysOrdered(state, config, studentKey, usedDaysForMateria, turno);
      let assigned = false;

      // Attempt 1: Normal (docente + physical space)
      if (!unidad.esPractica && docentesCand.length > 0 && espaciosCand.length > 0) {
        for (const dia of days) {
          if (assigned) break;
          const orderedWindows = orderWindowsByAdjacency(windows, state, studentKey, dia);
          for (const w of orderedWindows) {
            if (assigned) break;
            for (const doc of docentesCand) {
              if (!isDocenteDisponible(doc, dia, w)) continue;
              for (const esp of espaciosCand) {
                if (isValid(state, doc.id, esp.id, studentKey, dia, w, esp.aforo, materia.proyeccionInscritos || 0, materia.tipoAula, materia.escuela, esp, false)) {
                  applyAssignment(state, doc.id, esp.id, studentKey, dia, w);
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
          const orderedWindows = orderWindowsByAdjacency(windows, state, studentKey, dia);
          for (const w of orderedWindows) {
            if (assigned) break;
            for (const esp of espaciosCand) {
              if (isValid(state, null, esp.id, studentKey, dia, w, esp.aforo, materia.proyeccionInscritos || 0, materia.tipoAula, materia.escuela, esp, false)) {
                applyAssignment(state, null, esp.id, studentKey, dia, w);
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
          const orderedWindows = orderWindowsByAdjacency(windows, state, studentKey, dia);
          for (const w of orderedWindows) {
            if (assigned) break;
            for (const doc of docentesCand) {
              if (!isDocenteDisponible(doc, dia, w)) continue;
              if (isValid(state, doc.id, null, studentKey, dia, w, 9999, materia.proyeccionInscritos || 0, materia.tipoAula, materia.escuela, null, true)) {
                applyAssignment(state, doc.id, null, studentKey, dia, w);
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
          const orderedWindows = orderWindowsByAdjacency(windows, state, studentKey, dia);
          for (const w of orderedWindows) {
            if (assigned) break;
            if (isValid(state, null, null, studentKey, dia, w, 9999, materia.proyeccionInscritos || 0, materia.tipoAula, materia.escuela, null, true)) {
              applyAssignment(state, null, null, studentKey, dia, w);
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
