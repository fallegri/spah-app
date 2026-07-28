"use client";

import { useState, useEffect } from "react";
import { Save, Loader2, Plus, Trash2 } from "lucide-react";

interface AIConfig {
  id: number;
  provider: string;
  apiKey: string | null;
  baseUrl: string | null;
  model: string;
  activo: boolean;
}

export default function ConfiguracionPage() {
  const [configs, setConfigs] = useState<AIConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newProvider, setNewProvider] = useState({ provider: "nvidia", apiKey: "", baseUrl: "", model: "meta/llama-3.1-8b-instruct" });
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      const res = await fetch("/api/ai/config");
      const data = await res.json();
      if (data.ok) setConfigs(data.providers);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const saveProvider = async () => {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/ai/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProvider),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage("Proveedor guardado correctamente");
        setShowForm(false);
        setNewProvider({ provider: "nvidia", apiKey: "", baseUrl: "", model: "meta/llama-3.1-8b-instruct" });
        loadConfigs();
      }
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Configuracion</h1>
        <p className="text-gray-400 mt-1">Proveedores de IA y parametros del sistema</p>
      </div>

      {/* AI Providers */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Proveedores de IA</h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-xs text-white"
          >
            <Plus className="w-3.5 h-3.5" /> Agregar proveedor
          </button>
        </div>

        {/* Existing providers */}
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : configs.length === 0 ? (
          <p className="text-gray-500 text-sm py-4">No hay proveedores configurados en BD. Se usa la config de variables de entorno.</p>
        ) : (
          <div className="space-y-2">
            {configs.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${c.activo ? "bg-emerald-400" : "bg-gray-500"}`} />
                  <div>
                    <p className="text-sm text-white font-medium capitalize">{c.provider}</p>
                    <p className="text-xs text-gray-400">{c.model}</p>
                  </div>
                </div>
                <div className="text-xs text-gray-500 font-mono">
                  {c.apiKey || (c.baseUrl ? c.baseUrl : "env vars")}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* New provider form */}
        {showForm && (
          <div className="mt-4 p-4 bg-gray-800 rounded-lg border border-gray-700 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Proveedor</label>
                <select
                  value={newProvider.provider}
                  onChange={(e) => setNewProvider({ ...newProvider, provider: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white"
                >
                  <option value="nvidia">NVIDIA NIM</option>
                  <option value="openai">OpenAI</option>
                  <option value="ollama">Ollama (local)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Modelo</label>
                <input
                  type="text"
                  value={newProvider.model}
                  onChange={(e) => setNewProvider({ ...newProvider, model: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white"
                  placeholder="meta/llama-3.1-8b-instruct"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">API Key</label>
                <input
                  type="password"
                  value={newProvider.apiKey}
                  onChange={(e) => setNewProvider({ ...newProvider, apiKey: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white"
                  placeholder="nvapi-xxx o sk-xxx"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Base URL (solo Ollama)</label>
                <input
                  type="text"
                  value={newProvider.baseUrl}
                  onChange={(e) => setNewProvider({ ...newProvider, baseUrl: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white"
                  placeholder="http://localhost:11434"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white">
                Cancelar
              </button>
              <button
                onClick={saveProvider}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-xs text-white disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Guardar
              </button>
            </div>
          </div>
        )}

        {message && (
          <p className={`mt-3 text-xs ${message.includes("Error") ? "text-red-400" : "text-emerald-400"}`}>
            {message}
          </p>
        )}
      </div>

      {/* System info */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-4">Informacion del sistema</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="p-3 bg-gray-800 rounded-lg">
            <p className="text-xs text-gray-400">Version</p>
            <p className="text-white font-mono">SPAH v2.0</p>
          </div>
          <div className="p-3 bg-gray-800 rounded-lg">
            <p className="text-xs text-gray-400">Stack</p>
            <p className="text-white font-mono">Next.js 16 + Neon + Vercel</p>
          </div>
          <div className="p-3 bg-gray-800 rounded-lg">
            <p className="text-xs text-gray-400">Algoritmo</p>
            <p className="text-white font-mono">Greedy + Backtracking</p>
          </div>
          <div className="p-3 bg-gray-800 rounded-lg">
            <p className="text-xs text-gray-400">IA Default</p>
            <p className="text-white font-mono">NVIDIA Llama 3.1 8B</p>
          </div>
        </div>
      </div>
    </div>
  );
}
