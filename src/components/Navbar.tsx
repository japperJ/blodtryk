"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  ClipboardList,
  TrendingUp,
  User,
  Settings,
  Sun,
  Moon,
  Monitor,
  Check,
  type LucideIcon,
} from "lucide-react";

const links: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/scan", label: "Scan", icon: Camera },
  { href: "/readings", label: "Målinger", icon: ClipboardList },
  { href: "/trends", label: "Tendenser", icon: TrendingUp },
  { href: "/persons", label: "Personer", icon: User },
];

type ThemePref = "light" | "dark" | "system";
const THEME_KEY = "theme";
const THEME_COLOR = { light: "#2563eb", dark: "#111827" };

// Anvend temapræference: toggle .dark på <html> + synkroniser theme-color meta
function applyTheme(pref: ThemePref) {
  const dark =
    pref === "dark" ||
    (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document
    .getElementById("theme-color-meta")
    ?.setAttribute("content", dark ? THEME_COLOR.dark : THEME_COLOR.light);
}

export default function Navbar() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<ThemePref>("system");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Hent gemt præference efter mount (undgår SSR-mismatch)
  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark" || saved === "system") {
      setTheme(saved);
      applyTheme(saved);
    }
  }, []);

  // Følg system-skift mens præferencen er "system"
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme(theme);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [theme]);

  // Luk popover ved klik udenfor eller Escape
  useEffect(() => {
    if (!settingsOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSettingsOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [settingsOpen]);

  const chooseTheme = useCallback((pref: ThemePref) => {
    setTheme(pref);
    localStorage.setItem(THEME_KEY, pref);
    applyTheme(pref);
    setSettingsOpen(false);
  }, []);

  const themeOptions: { value: ThemePref; label: string; icon: LucideIcon }[] = [
    { value: "light", label: "Lys", icon: Sun },
    { value: "dark", label: "Mørk", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg z-50">
      <div className="max-w-lg mx-auto flex items-stretch">
        {links.map((link) => {
          const active = pathname === link.href || pathname.startsWith(link.href + "/");
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`flex-1 flex flex-col items-center py-3 transition-colors ${
                active
                  ? "text-primary-600 dark:text-primary-400"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              <Icon className="w-6 h-6" strokeWidth={active ? 2.25 : 2} aria-hidden />
              <span className="text-xs font-medium mt-1">{link.label}</span>
            </Link>
          );
        })}

        {/* Indstillinger — temavælger-popover */}
        <div ref={settingsRef} className="relative flex items-center px-1">
          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            aria-haspopup="true"
            aria-expanded={settingsOpen}
            aria-label="Indstillinger"
            title="Indstillinger"
            className="flex h-11 w-11 items-center justify-center rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <Settings className="w-6 h-6" aria-hidden />
          </button>

          {settingsOpen && (
            <div
              role="menu"
              aria-label="Tema"
              className="absolute bottom-[calc(100%+8px)] right-0 w-44 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg p-1.5"
            >
              <p className="px-2.5 pt-1 pb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Tema
              </p>
              {themeOptions.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={theme === value}
                  onClick={() => chooseTheme(value)}
                  className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-2.5 text-sm font-medium min-h-[44px] transition-colors ${
                    theme === value
                      ? "bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300"
                      : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" aria-hidden />
                  {label}
                  {theme === value && <Check className="w-4 h-4 ml-auto" aria-hidden />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
