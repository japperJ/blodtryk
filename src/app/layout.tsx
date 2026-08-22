import type { Metadata, Viewport } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import ReminderScheduler from "@/components/ReminderScheduler";

export const metadata: Metadata = {
  title: "Blodtryk",
  description: "Scan og gem dit blodtryk med AI",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Blodtryk" },
};

// Ingen zoom-begrænsninger i viewport — pinch-zoom skal altid virke (WCAG 1.4.4).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

// Kører FØR første paint: læser localStorage-nøglen "theme" ("light" | "dark" |
// "system", default system), toggler .dark på <html> og synkroniserer
// theme-color meta-tags, så der ikke er FOUC/tema-flash ved indlæsning.
const themeInitScript = `
(function () {
  try {
    var pref = localStorage.getItem("theme");
    var dark =
      pref === "dark" ||
      ((!pref || pref === "system") &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    var meta = document.getElementById("theme-color-meta");
    if (meta) meta.setAttribute("content", dark ? "#111827" : "#2563eb");
  } catch (e) {}
})();
`;

// Registrerer /sw.js (#16, kun til påmindelsesnotifikationer — ingen caching).
// ALDRIG i dev på localhost (undgår cache-hovedpine), men altid i production-builds.
// Hele registreringen er best-effort: guard + try/catch, så den aldrig kan bryde appen.
const swRegisterScript = `
(function () {
  try {
    if (!("serviceWorker" in navigator)) return;
    var isProd = ${process.env.NODE_ENV === "production"};
    var isLocalhost =
      location.hostname === "localhost" || location.hostname === "127.0.0.1";
    if (!isProd && isLocalhost) return;
    navigator.serviceWorker.register("/sw.js").catch(function () {});
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="da" suppressHydrationWarning>
      <head>
        {/* Opdateres af tema-scriptet og Navbar-toggle (lys: #2563eb, mørk: #111827) */}
        <meta id="theme-color-meta" name="theme-color" content="#2563eb" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="bg-gray-50 text-gray-900 antialiased dark:bg-gray-900 dark:text-gray-100">
        {children}
        <Navbar />
        <ReminderScheduler />
        {/* SW-registrering efter alt indhold (#16) */}
        <script dangerouslySetInnerHTML={{ __html: swRegisterScript }} />
      </body>
    </html>
  );
}
