"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/scan", label: "Scan", icon: "📸" },
  { href: "/readings", label: "Målinger", icon: "📋" },
  { href: "/persons", label: "Personer", icon: "👤" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-50">
      <div className="max-w-lg mx-auto flex">
        {links.map((link) => {
          const active = pathname === link.href || pathname.startsWith(link.href + "/");
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex-1 flex flex-col items-center py-3 transition-colors ${
                active ? "text-primary-600" : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <span className="text-xl">{link.icon}</span>
              <span className="text-xs font-medium mt-1">{link.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
