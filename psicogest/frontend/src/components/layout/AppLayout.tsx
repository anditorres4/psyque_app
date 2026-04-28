import { useCallback, useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { PatientSearch } from "@/components/patients/PatientSearch";

export function AppLayout() {
  const [searchOpen, setSearchOpen] = useState(false);

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
      <Sidebar onSearchClick={() => setSearchOpen(true)} />
      <div className="ml-60 min-h-screen flex flex-col">
        <Topbar />
        <main className="flex-1 px-8 py-7 max-w-[1400px] w-full">
          <Outlet />
        </main>
      </div>
      <PatientSearch isOpen={searchOpen} onClose={closeSearch} />
    </div>
  );
}
