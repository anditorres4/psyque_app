import { useCallback, useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { PatientSearch } from "@/components/patients/PatientSearch";
import { SubscriptionBanner } from "./SubscriptionBanner";

export function AppLayout() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const closeSearch = useCallback(() => setSearchOpen(false), []);

  return (
    <div className="min-h-screen" style={{ background: "var(--psy-bg)" }}>
      <Sidebar 
        onSearchClick={() => setSearchOpen(true)} 
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div className="lg:ml-60 min-h-screen flex flex-col">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        <SubscriptionBanner />
        <main className="flex-1 px-4 py-5 md:px-8 md:py-7 max-w-[1400px] w-full">
          <Outlet />
        </main>
      </div>
      <PatientSearch isOpen={searchOpen} onClose={closeSearch} />
    </div>
  );
}
