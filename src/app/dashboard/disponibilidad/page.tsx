"use client";

import { useState, useEffect } from "react";
import { Save, Loader2, CheckCircle } from "lucide-react";
import { SLOTS, DIAS } from "@/types/scheduler";
import type { Dia } from "@/types/scheduler";

export default function DisponibilidadPage() {
  const [grid, setGrid] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [docenteInfo, setDocenteInfo] = useState<any>(null);
  const gestion = "2026-II";

  useEffect(() => {
    loadDisponibilidad();
  }, []);

  const loadDisponibilidad = async () => {
    try {
      const res = await fetch(`/api/disponibilidad?gestion=${gestion}`);
      const data = await res.json();
      if (data.ok) {
        setDocenteInfo(data.docente);
        const newGrid: Record<string, boolean> = {};
        for (const slot of data.disponibilidad) {
          newGrid[`${slot.dia}|${slot.slot}`] = true;
        }
        setGrid(newGrid);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSlot = (dia: Dia, slot: string) => {
    const key = `${dia}|${slot}`;
    setGrid((prev) => ({ ...prev, [key]: !prev[key] }));
    setSaved(false);
  };

  const toggleTurno = (turno: "manana" | "tarde" | "noche") => {
    const turnoSlots =
      turno === "manana" ? SLOTS.slice(0, 7) :
      turno === "tarde" ? SLOTS.slice(7, 14) : SLOTS.slice(14);

    const allSelected = DIAS.slice(0, 6).every((dia) =>
      turnoSlots.every((slot) => grid[`${dia}|${slot}`])
    );

    const newGrid = { ...grid };
    for (const dia of DIAS.slice(0, 6)) {
      for (const slot of turnoSlots) {
        newGrid[`${dia}|${slot}`] = !allSelected;
      }
    }
    setGrid(newGrid);
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const slots = Object.entries(grid)
      .filter(([_, v]) => v)
      .map(([key]) => {
        const [dia, slot] = key.split("|");
        return { dia, slot };
      });

    try {
      const res = await fetch("/api/disponibilidad", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gestion, slots }),
      });
      const data = await res.json();
      if (data.ok) setSaved(true);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const totalSlots = Object.values(grid).filter(Boolean).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Mi disponibilidad</h1>
          <p className="text-gray-400 mt-1">
            {docenteInfo?.nombre} &middot; CI: {docenteInfo?.ci} &middot; Gestion {gestion}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">{totalSlots} bloques marcados</span>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-sm text-white transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? "Guardado" : "Guardar"}
          </button>
        </div>
      </div>

      {/* Quick turno buttons */}
      <div className="flex gap-2">
        <button onClick={() => toggleTurno("manana")} className="px-3 py-1.5 bg-amber-600/20 border border-amber-700 rounded-lg text-xs text-amber-300 hover:bg-amber-600/30">
          Turno Manana completo
        </button>
        <button onClick={() => toggleTurno("tarde")} className="px-3 py-1.5 bg-blue-600/20 border border-blue-700 rounded-lg text-xs text-blue-300 hover:bg-blue-600/30">
          Turno Tarde completo
        </button>
        <button onClick={() => toggleTurno("noche")} className="px-3 py-1.5 bg-purple-600/20 border border-purple-700 rounded-lg text-xs text-purple-300 hover:bg-purple-600/30">
          Turno Noche completo
        </button>
      </div>

      {/* Grid */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="px-2 py-1.5 text-left text-gray-400 font-medium">Hora</th>
              {DIAS.slice(0, 6).map((dia) => (
                <th key={dia} className="px-2 py-1.5 text-center text-gray-400 font-medium">
                  {dia.slice(0, 3)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SLOTS.map((slot, idx) => (
              <tr key={slot} className={idx === 7 || idx === 14 ? "border-t border-gray-700" : ""}>
                <td className="px-2 py-0.5 text-gray-500 font-mono">{slot}</td>
                {DIAS.slice(0, 6).map((dia) => {
                  const key = `${dia}|${slot}`;
                  const active = grid[key];
                  return (
                    <td key={key} className="px-1 py-0.5 text-center">
                      <button
                        onClick={() => toggleSlot(dia as Dia, slot)}
                        className={`w-full h-6 rounded transition-colors ${
                          active
                            ? "bg-emerald-500/30 border border-emerald-500"
                            : "bg-gray-800 border border-gray-700 hover:border-gray-600"
                        }`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
