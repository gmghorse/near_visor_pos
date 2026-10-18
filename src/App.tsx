import { useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import {
  BellIcon,
  CashRegisterIcon,
  CaretDoubleLeftIcon,
  CaretDoubleRightIcon,
  ChartBarIcon,
  GearIcon,
  MoonIcon,
  PackageIcon,
  ReceiptIcon,
  SquaresFourIcon,
  StorefrontIcon,
  SunIcon,
  WarehouseIcon,
} from "@phosphor-icons/react";
import { useUiStore } from "@/stores/ui";
import "./App.css";

const navItems = [
  { title: "Dashboard", to: "/", icon: SquaresFourIcon },
  { title: "POS", to: "/pos", icon: CashRegisterIcon },
  { title: "Inventory", to: "/inventory", icon: WarehouseIcon },
  { title: "Products", to: "/products", icon: PackageIcon },
  { title: "Reports", to: "/reports", icon: ChartBarIcon },
  { title: "Sales History", to: "/sales-history", icon: ReceiptIcon },
  { title: "Settings", to: "/settings", icon: GearIcon },
];

function App() {
  const { pathname } = useLocation();
  const { theme, sidebarCollapsed, toggleSidebar, toggleTheme } = useUiStore();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const isActive = (to: string) =>
      to === "/" ? pathname === "/" : pathname.startsWith(to);

  const currentPage = navItems.find((item) => isActive(item.to))?.title ?? "Dashboard";

  return (
    <div className="app-shell">
      <aside className={`app-sidebar ${sidebarCollapsed ? "is-collapsed" : ""}`}>
        <div className="brand-lockup">
          <div className="brand-mark"><StorefrontIcon weight="fill" /></div>
          {!sidebarCollapsed && <div><div className="brand-name">NearVisor</div><div className="brand-subtitle">Point of sale</div></div>}
        </div>
        <div className="nav-section-label">Workspace</div>
        <nav className="app-nav">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} title={sidebarCollapsed ? item.title : undefined} className={`app-nav-link ${isActive(item.to) ? "is-active" : ""}`}>
              <item.icon weight={isActive(item.to) ? "fill" : "regular"} />
              {!sidebarCollapsed && <span>{item.title}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="online-status"><span className="status-dot" />{!sidebarCollapsed && "Local database connected"}</div>
          <button className="collapse-button" onClick={toggleSidebar} aria-label="Toggle sidebar">
            {sidebarCollapsed ? <CaretDoubleRightIcon /> : <CaretDoubleLeftIcon />} {!sidebarCollapsed && "Collapse"}
          </button>
        </div>
      </aside>
      <main className="app-main">
        <header className="topbar">
          <div><div className="eyebrow">Workspace</div><h1>{currentPage}</h1></div>
          <div className="topbar-actions">
            <button className="icon-button" aria-label="Notifications"><BellIcon /></button>
            <button className="icon-button" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === "light" ? <MoonIcon /> : <SunIcon />}
            </button>
            <div className="user-chip"><div className="avatar">A</div><div className="user-copy"><strong>Admin</strong><span>Store manager</span></div></div>
          </div>
        </header>
        <div className="page-content"><Outlet /></div>
      </main>
    </div>
  );
}

export default App;
