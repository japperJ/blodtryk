"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Camera, ClipboardList, TrendingUp, User, type LucideIcon } from "lucide-react";

const links: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/scan", label: "Scan", icon: Camera },
  { href: "/readings", label: "Målinger", icon: ClipboardList },
  { href: "/trends", label: "Tendenser", icon: TrendingUp },
  { href: "/persons", label: "Personer", icon: User },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-50">
      <div className="max-w-lg mx-auto flex">
        {links.map((link) => {
          const active = pathname === link.href || pathname.startsWith(link.href + "/");
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`flex-1 flex flex-col items-center py-3 transition-colors ${
                active ? "text-primary-600" : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <Icon className="w-6 h-6" strokeWidth={active ? 2.25 : 2} aria-hidden />
              <span className="text-xs font-medium mt-1">{link.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
