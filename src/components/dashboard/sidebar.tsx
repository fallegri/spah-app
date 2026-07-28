"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Calendar,
  Upload,
  Play,
  BarChart3,
  Users,
  Building,
  BookOpen,
  Settings,
  Bot,
  LogOut,
  Clock,
} from "lucide-react";

interface SidebarProps {
  role: string;
  userName: string;
}

const adminLinks = [
  { href: "/dashboard", label: "Resumen", icon: BarChart3 },
  { href: "/dashboard/carga", label: "Carga de datos", icon: Upload },
  { href: "/dashboard/docentes", label: "Docentes", icon: Users },
  { href: "/dashboard/materias", label: "Materias", icon: BookOpen },
  { href: "/dashboard/espacios", label: "Espacios", icon: Building },
  { href: "/dashboard/scheduler", label: "Ejecutar", icon: Play },
  { href: "/dashboard/resultados", label: "Resultados", icon: Calendar },
  { href: "/dashboard/ai", label: "Asistente IA", icon: Bot },
  { href: "/dashboard/configuracion", label: "Configuracion", icon: Settings },
];

const docenteLinks = [
  { href: "/dashboard", label: "Mi horario", icon: Calendar },
  { href: "/dashboard/disponibilidad", label: "Disponibilidad", icon: Clock },
];

const asistenteLinks = [
  { href: "/dashboard", label: "Resumen", icon: BarChart3 },
  { href: "/dashboard/resultados", label: "Horarios", icon: Calendar },
  { href: "/dashboard/docentes", label: "Docentes", icon: Users },
];

export function Sidebar({ role, userName }: SidebarProps) {
  const pathname = usePathname();

  const links =
    role === "administrador"
      ? adminLinks
      : role === "docente"
      ? docenteLinks
      : asistenteLinks;

  return (
    <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center">
            <Calendar className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white">SPAH</h1>
            <p className="text-[10px] text-gray-500 uppercase">{role}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {links.map((link) => {
          const isActive = pathname === link.href;
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-blue-600/20 text-blue-400"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              {link.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-gray-800">
        <div className="flex items-center justify-between">
          <div className="truncate">
            <p className="text-xs text-white truncate">{userName}</p>
            <p className="text-[10px] text-gray-500">{role}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="p-2 text-gray-400 hover:text-red-400 rounded-lg hover:bg-gray-800 transition-colors"
            title="Cerrar sesion"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
