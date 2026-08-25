import { NavLink, Outlet } from "react-router-dom";
import { useServerMetadata } from "../hooks/useOrganizations";

const navItems = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/hierarchy", label: "Hierarchy" },
  { to: "/directory", label: "Directory" },
];

export default function Layout() {
  const meta = useServerMetadata();
  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-3 flex items-center gap-6">
          <div className="font-semibold text-slate-900">
            Atlas
            <span className="ml-2 text-xs font-normal text-slate-500">
              directory sandbox
            </span>
          </div>
          <nav className="flex gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-md text-sm font-medium ${
                    isActive
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto text-xs text-slate-500">
            {meta.isLoading && "checking server..."}
            {meta.isError && (
              <span className="text-red-600">server unreachable</span>
            )}
            {meta.data && (
              <span>
                {meta.data.software?.name ?? "FHIR"} ·{" "}
                {meta.data.fhirVersion ?? ""}
              </span>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-7xl px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}
