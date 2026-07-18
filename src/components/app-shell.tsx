"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Building2, CalendarClock, ClipboardCheck, Columns3, FileScan, House, LogOut, Menu, Plus, Shield, Users } from "lucide-react";
import { logoutAction } from "@/app/actions";
import type { ProfileRow } from "@/lib/data";
import { cn } from "@/lib/utils";
import { useState } from "react";

const primary = [
  { href: "/", label: "Hoje", icon: House },
  { href: "/leads", label: "Clientes", icon: Users },
  { href: "/retornos", label: "Retornos", icon: CalendarClock },
  { href: "/pipeline", label: "Funil", icon: Columns3 },
];

const mobilePrimary = primary.slice(0, 3);

const adminItems = [
  { href: "/estatisticas", label: "Resumo Mensal", icon: BarChart3 },
  { href: "/usuarios", label: "Equipe", icon: Users },
  { href: "/bancos", label: "Bancos", icon: Building2 },
];

const adminMobileItems = [
  { href: "/leads/importar", label: "Importar ficha — teste", icon: FileScan },
  ...adminItems,
];

const devItems = [
  { href: "/homologacao", label: "Homologação", icon: ClipboardCheck },
];

export function AppShell({ children, profile, pendingCount }: { children: React.ReactNode; profile: ProfileRow; pendingCount: number }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const isAdmin = profile.role === "admin";
  const homologationEnabled =
    process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_ENABLE_HOMOLOGATION === "true";
  const showHomologation = homologationEnabled && isAdmin;
  const desktopNav = primary;

  return (
    <main className="min-h-screen bg-[#F6F7FB] pb-[calc(92px+env(safe-area-inset-bottom))] text-slate-950 lg:pb-0 lg:pl-72">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-slate-200 bg-white px-5 py-6 lg:block">
        <div className="mb-8">
          <Image src="/brand/logo-horizontal.webp" alt="Aliança Motos Avelloz" width={192} height={64} className="h-auto w-[190px]" priority />
          <p className="mt-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Operação diária</p>
        </div>
        <nav className="space-y-2">
          {desktopNav.map((item) => <NavLink key={item.href} item={item} pathname={pathname} />)}
        </nav>
        {isAdmin && (
          <div className="mt-8 border-t border-slate-100 pt-5">
            <p className="mb-2 px-3 text-xs font-black uppercase tracking-[0.18em] text-slate-400">Administração</p>
            <nav className="space-y-2">
              {adminItems.map((item) => <NavLink key={item.href} item={item} pathname={pathname} />)}
              {showHomologation && devItems.map((item) => <NavLink key={item.href} item={item} pathname={pathname} />)}
            </nav>
          </div>
        )}
        <form action={logoutAction} className="mt-8">
          <button className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-extrabold text-slate-600 hover:bg-slate-100">
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </form>
      </aside>

      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <Image src="/brand/favicon.png" alt="" width={36} height={36} className="h-9 w-9" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-[#031A4A]">{sectionTitle(pathname)}</p>
            <p className="truncate text-xs font-bold text-slate-500">{profile.full_name}</p>
          </div>
          <span className="rounded-full bg-orange-100 px-2 py-1 text-xs font-black text-orange-700">{pendingCount}</span>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-5 lg:px-8">{children}</div>

      <Link href="/leads/novo" className="fixed bottom-[calc(78px+env(safe-area-inset-bottom))] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#E84A2A] text-white shadow-lg lg:hidden">
        <Plus className="h-7 w-7" />
        <span className="sr-only">Novo cliente</span>
      </Link>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">
        <div className="grid grid-cols-4 gap-1">
          {mobilePrimary.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn("flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-black", pathname === item.href ? "bg-[#031A4A] text-white" : "text-slate-500")}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          ))}
          <button type="button" onClick={() => setMoreOpen(true)} className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-black text-slate-500">
            <Menu className="h-5 w-5" />
            Mais
          </button>
        </div>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/30 lg:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white p-4 pb-[calc(18px+env(safe-area-inset-bottom))]" onClick={(event) => event.stopPropagation()}>
            <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-slate-200" />
            <div className="grid gap-2">
              <SheetLink href="/pipeline" label="Funil" icon={Columns3} onClick={() => setMoreOpen(false)} />
              {isAdmin && (
                <>
                  <div className="mt-2 flex items-center gap-2 px-1 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                    <Shield className="h-4 w-4" />
                    Administração
                  </div>
                  {adminMobileItems.map((item) => <SheetLink key={item.href} href={item.href} label={item.label} icon={item.icon} onClick={() => setMoreOpen(false)} />)}
                  {showHomologation && devItems.map((item) => <SheetLink key={item.href} href={item.href} label={item.label} icon={item.icon} onClick={() => setMoreOpen(false)} />)}
                </>
              )}
              <form action={logoutAction}>
                <button className="flex min-h-12 w-full items-center gap-3 rounded-lg bg-slate-50 px-3 text-sm font-black">
                  <LogOut className="h-5 w-5 text-orange-600" />
                  Sair
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function NavLink({ item, pathname }: { item: { href: string; label: string; icon: React.ElementType }; pathname: string }) {
  return (
    <Link
      href={item.href}
      className={cn("flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-extrabold transition", pathname === item.href ? "bg-[#031A4A] text-white" : "text-slate-600 hover:bg-slate-100")}
    >
      <item.icon className="h-4 w-4" />
      {item.label}
    </Link>
  );
}

function SheetLink({ href, label, icon: Icon, onClick }: { href: string; label: string; icon: React.ElementType; onClick: () => void }) {
  return (
    <Link href={href} onClick={onClick} className="flex min-h-12 items-center gap-3 rounded-lg bg-slate-50 px-3 text-sm font-black">
      <Icon className="h-5 w-5 text-orange-600" />
      {label}
    </Link>
  );
}

function sectionTitle(pathname: string) {
  if (pathname.startsWith("/leads/novo")) return "Novo cliente";
  if (pathname.startsWith("/leads/importar")) return "Importar ficha — teste";
  if (pathname.startsWith("/leads/")) return "Cliente";
  if (pathname.startsWith("/leads")) return "Clientes";
  if (pathname.startsWith("/retornos")) return "Retornos";
  if (pathname.startsWith("/pipeline")) return "Funil";
  if (pathname.startsWith("/estatisticas")) return "Resumo Mensal";
  if (pathname.startsWith("/bancos")) return "Bancos";
  if (pathname.startsWith("/usuarios")) return "Equipe";
  if (pathname.startsWith("/homologacao")) return "Homologação";
  return "Hoje";
}
