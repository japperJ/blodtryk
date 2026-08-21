import type { Metadata, Viewport } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

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
      </body>
    </html>
  );
}
