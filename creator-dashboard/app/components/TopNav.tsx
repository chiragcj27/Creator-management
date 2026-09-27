"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRole } from "@/lib/RoleContext";
import { ROLE_LABEL } from "@/lib/role";

const TABS = [
  { href: "/", label: "Creators" },
  { href: "/campaigns", label: "Campaigns" },
];

export default function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const role = useRole();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="flex items-center gap-1.5">
      {TABS.map((t) => {
        const active = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`btn-ghost ${active ? "border-hero-ink bg-hero-ink/15" : ""}`}
          >
            {t.label}
          </Link>
        );
      })}
      {role && (
        <>
          <span className="ml-1 hidden rounded-full border border-hero-ink/25 px-3 py-1 text-xs text-hero-ink/70 sm:inline">
            {ROLE_LABEL[role]}
          </span>
          <button className="btn-ghost" onClick={logout}>Log out</button>
        </>
      )}
    </nav>
  );
}
