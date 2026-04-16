import { useCallback, useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { PatientSearch } from "@/components/patients/PatientSearch";

export function AppLayout() {
  const [searchOpen, setSearchOpen] = useState(false);

  // Ctrl+K / Cmd+K opens global search — RF-PAC-02
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
    <div className="min-h-screen bg-[#F8FAFC]">
      <Sidebar onSearchClick={() => setSearchOpen(true)} />
      <main className="ml-60 min-h-screen p-0">
        <Outlet />
      </main>
      <PatientSearch isOpen={searchOpen} onClose={closeSearch} />
    </div>
  );
}
