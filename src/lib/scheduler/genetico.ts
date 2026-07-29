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
} from "@/types/scheduler";
import {
  buildStudentGroupKey,
  inferirTurno,
  buildWorkUnits,
  createOccupancyState,
  cloneOccupancyState,
  isValid,
  applyAssignment,
  getWindows,
  calcGap,
  getDaysOrdered,
  getCandidateDocentes,
  getCandidateEspacios,
  isDocenteDisponible,
  OccupancyState,
} from "./shared";

// ======================================================================
// GENETIC ALGORITHM
// Generates initial population via randomized greedy, evaluates fitness,
// applies tournament selection, crossover at session level, mutation
// (re-assign random sessions), runs for G generations, returns best.
// ======================================================================

// --- Internal types for genetic representation ---

interface SessionGene {
  unidadIdx: number;
  sesionIdx: number;
  // Assignment result (null if conflict)
  dia: Dia | null;
  slots: string[];
  docenteId: number | null;
  docenteNombre: string;
  espacioId: number | null;
  espacioCodigo: string;
  esAIR: boolean;
  esSinDocente: boolean;
  isConflict: boolean;
  motivo: string;
}

interface Individual {
  genes: SessionGene[];
  fitness: number;
}

// --- Random utility ---

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min)) + min;
}

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randInt(0, i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// --- Generate one individual using randomized greedy ---

function generateIndividual(
  unidades: UnidadTrabajo[],
  docentes: Docente[],
  espacios: Espacio[],
  reservas: ReservaExterna[],
  config: SchedulerConfig
): Individual {
  const state = createOccupancyState(reservas);
  const genes: SessionGene[] = [];

  // Process units in a shuffled order for diversity
  const shuffledIndices = shuffle(Array.from({ length: unidades.length }, (_, i) => i));

  // Track used days per unit to spread sessions across different days
  const usedDaysMap = new Map<number, Dia[]>();

  for (const uIdx of shuffledIndices) {
    const unidad = unidades[uIdx];
    const materia = unidad.materia;
    const studentKey = buildStudentGroupKey(materia.carrera, materia.semestre, materia.grupoCodigo);
    const turno = inferirTurno(materia.turno as string);
    const docentesCand = getCandidateDocentes(unidad, docentes);
    const espaciosCand = getCandidateEspacios(unidad, espacios);

    const usedDays = usedDaysMap.get(uIdx) || [];

    for (let sesIdx = 0; sesIdx < unidad.sesiones.length; sesIdx++) {
      const nBloques = Math.max(unidad.sesiones[sesIdx], 2);
      const windows = getWindows(nBloques, turno);

      if (windows.length === 0) {
        genes.push({
          unidadIdx: uIdx, sesionIdx: sesIdx,
          dia: null, slots: [], docenteId: null, docenteNombre: "",
          espacioId: null, espacioCodigo: "", esAIR: false, esSinDocente: false,
          isConflict: true, motivo: `No hay ventanas de ${nBloques} bloques en turno ${turno}`,
        });
        continue;
      }

      const days = shuffle(getDaysOrdered(state, config, studentKey, usedDays, turno));
      const shuffledWindows = shuffle(windows);
      let assigned = false;

      // Randomized greedy: shuffle candidates and pick first valid
      const shuffledDocentes = shuffle(docentesCand);
      const shuffledEspacios = shuffle(espaciosCand);

      // Try: Docente + Physical space
      if (!unidad.esPractica && shuffledDocentes.length > 0 && shuffledEspacios.length > 0) {
        for (const dia of days) {
          if (assigned) break;
          for (const w of shuffledWindows) {
            if (assigned) break;
            for (const doc of shuffledDocentes) {
              if (!isDocenteDisponible(doc, dia, w)) continue;
              for (const esp of shuffledEspacios) {
                if (isValid(state, doc.id, esp.id, studentKey, dia, w, esp.aforo, materia.proyeccionInscritos || 0, materia.tipoAula, materia.escuela, esp, false)) {
                  applyAssignment(state, doc.id, esp.id, studentKey, dia, w);
                  genes.push({
                    unidadIdx: uIdx, sesionIdx: sesIdx,
                    dia, slots: w, docenteId: doc.id, docenteNombre: doc.nombre,
                    espacioId: esp.id, espacioCodigo: esp.codigo,
                    esAIR: false, esSinDocente: false, isConflict: false, motivo: "",
                  });
                  usedDays.push(dia);
                  assigned = true;
                  break;
                }
              }
              if (assigned) break;
            }
          }
        }
      }

      // Try: Sin Docente + Physical space
      if (!assigned && !unidad.esPractica && shuffledEspacios.length > 0) {
        for (const dia of days) {
          if (assigned) break;
          for (const w of shuffledWindows) {
            if (assigned) break;
            for (const esp of shuffledEspacios) {
              if (isValid(state, null, esp.id, studentKey, dia, w, esp.aforo, materia.proyeccionInscritos || 0, materia.tipoAula, materia.escuela, esp, false)) {
                applyAssignment(state, null, esp.id, studentKey, dia, w);
                genes.push({
                  unidadIdx: uIdx, sesionIdx: sesIdx,
                  dia, slots: w, docenteId: null, docenteNombre: "Sin Docente",
                  espacioId: esp.id, espacioCodigo: esp.codigo,
                  esAIR: false, esSinDocente: true, isConflict: false, motivo: "",
                });
                usedDays.push(dia);
                assigned = true;
                break;
              }
            }
          }
        }
      }

      // Try: Docente + AIR
      if (!assigned && !unidad.esPractica && shuffledDocentes.length > 0) {
        for (const dia of days) {
          if (assigned) break;
          for (const w of shuffledWindows) {
            if (assigned) break;
            for (const doc of shuffledDocentes) {
              if (!isDocenteDisponible(doc, dia, w)) continue;
              if (isValid(state, doc.id, null, studentKey, dia, w, 9999, materia.proyeccionInscritos || 0, materia.tipoAula, materia.escuela, null, true)) {
                applyAssignment(state, doc.id, null, studentKey, dia, w);
                genes.push({
                  unidadIdx: uIdx, sesionIdx: sesIdx,
                  dia, slots: w, docenteId: doc.id, docenteNombre: doc.nombre,
                  espacioId: null, espacioCodigo: "AIR",
                  esAIR: true, esSinDocente: false, isConflict: false, motivo: "",
                });
                usedDays.push(dia);
                assigned = true;
                break;
              }
            }
          }
        }
      }

      // Try: AIR + Sin Docente
      if (!assigned) {
        for (const dia of days) {
          if (assigned) break;
          for (const w of shuffledWindows) {
            if (assigned) break;
            if (isValid(state, null, null, studentKey, dia, w, 9999, materia.proyeccionInscritos || 0, materia.tipoAula, materia.escuela, null, true)) {
              applyAssignment(state, null, null, studentKey, dia, w);
              genes.push({
                unidadIdx: uIdx, sesionIdx: sesIdx,
                dia, slots: w, docenteId: null, docenteNombre: "Sin Docente",
                espacioId: null, espacioCodigo: "AIR",
                esAIR: true, esSinDocente: true, isConflict: false, motivo: "",
              });
              usedDays.push(dia);
              assigned = true;
              break;
            }
          }
        }
      }

      if (!assigned) {
        genes.push({
          unidadIdx: uIdx, sesionIdx: sesIdx,
          dia: null, slots: [], docenteId: null, docenteNombre: "",
          espacioId: null, espacioCodigo: "", esAIR: false, esSinDocente: false,
          isConflict: true, motivo: "No se encontro combinacion valida incluso con AIR + Sin Docente",
        });
      }
    }

    usedDaysMap.set(uIdx, usedDays);
  }

  const fitness = evaluateFitness(genes);
  return { genes, fitness };
}

// --- Fitness evaluation ---

function evaluateFitness(genes: SessionGene[]): number {
  let score = 0;

  for (const gene of genes) {
    if (gene.isConflict) {
      score -= 100; // Heavy penalty for unresolved conflicts
    } else {
      score += 50; // Reward for each successful assignment
      if (gene.esAIR) score -= 15; // Penalty for AIR
      if (gene.esSinDocente) score -= 12; // Penalty for no teacher
    }
  }

  return score;
}

// --- Tournament selection ---

function tournamentSelect(population: Individual[], tournamentSize: number): Individual {
  let best: Individual | null = null;
  for (let i = 0; i < tournamentSize; i++) {
    const idx = randInt(0, population.length);
    if (best === null || population[idx].fitness > best.fitness) {
      best = population[idx];
    }
  }
  return best!;
}

// --- Crossover: single-point at session level ---

function crossover(parent1: Individual, parent2: Individual): [SessionGene[], SessionGene[]] {
  const len = Math.min(parent1.genes.length, parent2.genes.length);
  if (len <= 1) return [[...parent1.genes], [...parent2.genes]];

  const point = randInt(1, len);
  const child1Genes = [...parent1.genes.slice(0, point), ...parent2.genes.slice(point)];
  const child2Genes = [...parent2.genes.slice(0, point), ...parent1.genes.slice(point)];

  return [child1Genes, child2Genes];
}

// --- Mutation: re-assign random sessions ---

function mutate(
  genes: SessionGene[],
  mutationRate: number,
  unidades: UnidadTrabajo[],
  docentes: Docente[],
  espacios: Espacio[],
  reservas: ReservaExterna[],
  config: SchedulerConfig
): SessionGene[] {
  const result = [...genes];

  for (let i = 0; i < result.length; i++) {
    if (Math.random() > mutationRate) continue;

    const gene = result[i];
    const unidad = unidades[gene.unidadIdx];
    if (!unidad) continue;

    const materia = unidad.materia;
    const studentKey = buildStudentGroupKey(materia.carrera, materia.semestre, materia.grupoCodigo);
    const turno = inferirTurno(materia.turno as string);
    const nBloques = Math.max(unidad.sesiones[gene.sesionIdx], 2);
    const windows = getWindows(nBloques, turno);
    if (windows.length === 0) continue;

    // Build a temporary state from all OTHER genes (excluding current one)
    const tempState = createOccupancyState(reservas);
    for (let j = 0; j < result.length; j++) {
      if (j === i) continue;
      const other = result[j];
      if (other.isConflict || !other.dia) continue;
      const otherUnidad = unidades[other.unidadIdx];
      if (!otherUnidad) continue;
      const otherStudentKey = buildStudentGroupKey(
        otherUnidad.materia.carrera, otherUnidad.materia.semestre, otherUnidad.materia.grupoCodigo
      );
      applyAssignment(tempState, other.docenteId, other.espacioId, otherStudentKey, other.dia, other.slots);
    }

    // Try to find a new valid assignment
    const docentesCand = shuffle(getCandidateDocentes(unidad, docentes));
    const espaciosCand = shuffle(getCandidateEspacios(unidad, espacios));
    const days = shuffle(getDaysOrdered(tempState, config, studentKey, [], turno));
    const shuffledWindows = shuffle(windows);

    let mutated = false;

    // Try docente + space
    if (!unidad.esPractica && docentesCand.length > 0 && espaciosCand.length > 0) {
      for (const dia of days) {
        if (mutated) break;
        for (const w of shuffledWindows) {
          if (mutated) break;
          for (const doc of docentesCand) {
            if (!isDocenteDisponible(doc, dia, w)) continue;
            for (const esp of espaciosCand) {
              if (isValid(tempState, doc.id, esp.id, studentKey, dia, w, esp.aforo, materia.proyeccionInscritos || 0, materia.tipoAula, materia.escuela, esp, false)) {
                result[i] = {
                  ...gene, dia, slots: w, docenteId: doc.id, docenteNombre: doc.nombre,
                  espacioId: esp.id, espacioCodigo: esp.codigo,
                  esAIR: false, esSinDocente: false, isConflict: false, motivo: "",
                };
                mutated = true;
                break;
              }
            }
            if (mutated) break;
          }
        }
      }
    }

    // Fallback: AIR + Sin Docente
    if (!mutated) {
      for (const dia of days) {
        if (mutated) break;
        for (const w of shuffledWindows) {
          if (mutated) break;
          if (isValid(tempState, null, null, studentKey, dia, w, 9999, materia.proyeccionInscritos || 0, materia.tipoAula, materia.escuela, null, true)) {
            result[i] = {
              ...gene, dia, slots: w, docenteId: null, docenteNombre: "Sin Docente",
              espacioId: null, espacioCodigo: "AIR",
              esAIR: true, esSinDocente: true, isConflict: false, motivo: "",
            };
            mutated = true;
          }
        }
      }
    }
  }

  return result;
}

// --- Repair: validate all genes against constraints, mark invalid as conflicts ---

function repairAndEvaluate(
  genes: SessionGene[],
  unidades: UnidadTrabajo[],
  reservas: ReservaExterna[]
): { repairedGenes: SessionGene[]; fitness: number } {
  const state = createOccupancyState(reservas);
  const repairedGenes: SessionGene[] = [];

  for (const gene of genes) {
    if (gene.isConflict || !gene.dia) {
      repairedGenes.push(gene);
      continue;
    }

    const unidad = unidades[gene.unidadIdx];
    if (!unidad) {
      repairedGenes.push({ ...gene, isConflict: true, motivo: "Unidad no encontrada" });
      continue;
    }

    const materia = unidad.materia;
    const studentKey = buildStudentGroupKey(materia.carrera, materia.semestre, materia.grupoCodigo);

    if (isValid(state, gene.docenteId, gene.espacioId, studentKey, gene.dia, gene.slots, 9999, materia.proyeccionInscritos || 0, materia.tipoAula, materia.escuela, null, gene.esAIR)) {
      applyAssignment(state, gene.docenteId, gene.espacioId, studentKey, gene.dia, gene.slots);
      repairedGenes.push(gene);
    } else {
      // Conflict: this assignment is no longer valid
      repairedGenes.push({
        ...gene, isConflict: true, motivo: "Conflicto tras crossover/mutacion",
      });
    }
  }

  const fitness = evaluateFitness(repairedGenes);
  return { repairedGenes, fitness };
}

// --- Main genetic algorithm entry point ---

export function ejecutarGenetico(
  docentes: Docente[],
  materias: MateriaCatalogo[],
  espacios: Espacio[],
  reservas: ReservaExterna[],
  config: SchedulerConfig
): SchedulerResult {
  const startTime = Date.now();
  const log: string[] = [];

  const populationSize = config.genetico_poblacion || 50;
  const generations = config.genetico_generaciones || 100;
  const mutationRate = config.genetico_mutacion || 0.1;
  const tournamentSize = 3;

  log.push(`[INFO] Algoritmo: Genetico`);
  log.push(`[INFO] Poblacion: ${populationSize}, Generaciones: ${generations}, Mutacion: ${mutationRate}`);
  log.push(`[INFO] Docentes: ${docentes.length}, Espacios: ${espacios.length}, Reservas: ${reservas.length}`);

  // Build work units (used for reference in all individuals)
  const unidades = buildWorkUnits(materias, espacios, docentes, config);
  log.push(`[FASE 1] ${unidades.length} unidades de trabajo construidas`);

  if (unidades.length === 0) {
    return {
      asignaciones: [],
      conflictos: [],
      totalAsignadas: 0,
      totalConflictos: 0,
      totalAIR: 0,
      totalSinDocente: 0,
      duracionMs: Date.now() - startTime,
      log,
    };
  }

  // Step 1: Generate initial population via randomized greedy
  log.push(`[FASE 2] Generando poblacion inicial...`);
  let population: Individual[] = [];
  for (let i = 0; i < populationSize; i++) {
    population.push(generateIndividual(unidades, docentes, espacios, reservas, config));
  }

  let bestEver: Individual = population.reduce((best, ind) => ind.fitness > best.fitness ? ind : best, population[0]);
  log.push(`[GEN 0] Mejor fitness: ${bestEver.fitness}`);

  // Step 2: Evolution loop
  for (let gen = 1; gen <= generations; gen++) {
    const newPopulation: Individual[] = [];

    // Elitism: keep best individual
    newPopulation.push(bestEver);

    while (newPopulation.length < populationSize) {
      // Selection
      const parent1 = tournamentSelect(population, tournamentSize);
      const parent2 = tournamentSelect(population, tournamentSize);

      // Crossover
      const [child1Genes, child2Genes] = crossover(parent1, parent2);

      // Mutation
      const mutated1 = mutate(child1Genes, mutationRate, unidades, docentes, espacios, reservas, config);
      const mutated2 = mutate(child2Genes, mutationRate, unidades, docentes, espacios, reservas, config);

      // Repair and evaluate
      const { repairedGenes: repaired1, fitness: fit1 } = repairAndEvaluate(mutated1, unidades, reservas);
      const { repairedGenes: repaired2, fitness: fit2 } = repairAndEvaluate(mutated2, unidades, reservas);

      newPopulation.push({ genes: repaired1, fitness: fit1 });
      if (newPopulation.length < populationSize) {
        newPopulation.push({ genes: repaired2, fitness: fit2 });
      }
    }

    population = newPopulation;

    // Update best
    const genBest = population.reduce((best, ind) => ind.fitness > best.fitness ? ind : best, population[0]);
    if (genBest.fitness > bestEver.fitness) {
      bestEver = genBest;
    }

    if (gen % 10 === 0 || gen === generations) {
      log.push(`[GEN ${gen}] Mejor fitness: ${bestEver.fitness}`);
    }
  }

  // Step 3: Convert best individual to SchedulerResult
  const asignaciones: Asignacion[] = [];
  const conflictos: Conflicto[] = [];

  for (const gene of bestEver.genes) {
    const unidad = unidades[gene.unidadIdx];
    if (!unidad) continue;
    const materia = unidad.materia;
    const turno = inferirTurno(materia.turno as string);

    if (gene.isConflict || !gene.dia) {
      conflictos.push({
        materiaCodigo: materia.codigo,
        materiaNombre: materia.nombreAsignatura,
        grupoCodigo: materia.grupoCodigo,
        carrera: materia.carrera,
        semestre: materia.semestre,
        sesionIndex: gene.sesionIdx,
        motivo: gene.motivo || "Sin asignacion valida",
      });
    } else {
      asignaciones.push({
        materiaCodigo: materia.codigo, materiaNombre: materia.nombreAsignatura,
        grupoCodigo: materia.grupoCodigo, carrera: materia.carrera, semestre: materia.semestre,
        docenteId: gene.docenteId, docenteNombre: gene.docenteNombre,
        espacioId: gene.espacioId, espacioCodigo: gene.espacioCodigo,
        dia: gene.dia, slots: gene.slots, turno, tipoEspacio: materia.tipoAula,
        esAIR: gene.esAIR, esSinDocente: gene.esSinDocente, sesionIndex: gene.sesionIdx,
      });
    }
  }

  const duracion = Date.now() - startTime;
  log.push(`[FIN] Genetico completado en ${duracion}ms. Asignadas: ${asignaciones.length}, Conflictos: ${conflictos.length}`);

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
