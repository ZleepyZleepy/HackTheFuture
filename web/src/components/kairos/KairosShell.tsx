"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function KairosShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  const nav = useMemo(
    () => [
      { label: "Dashboard", href: "/kairos", icon: "" },
      { label: "Analysis", href: "/kairos/analysis", icon: "" },
      { label: "Data Upload", href: "/kairos/data", icon: "" },
      { label: "Insider Sources", href: "/kairos/sources", icon: "" }, // ✅ icon back
      { label: "Run History", href: "/kairos/history", icon: "" },
    ],
    []
  );

  async function handleSignOut() {
    await signOut(auth);
    window.location.href = "/";
  }

  return (
    <div className={`dashboard ${sidebarOpen ? "dashboard--sidebar-open" : ""}`} id="app">
      {/* Sidebar */}
      <nav className="sidebar dashboard__sidebar" id="sidebar" aria-label="Sidebar Navigation">
        {/* ✅ Logo image instead of text */}
        <div className="sidebar__logo" aria-label="Kairos Logo" style={{ left: 24, top: 18 }}>
          <img
            src="/kairos-logo.png"
            alt="Kairos"
            style={{ height: 42, width: "auto", display: "block" }}
          />
        </div>

        {/* ✅ removed divider + 'PAGES' */}

        <div className="sidebar__nav" style={{ top: 86 }}>
          <ul className="sidebar__list">
            {nav.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href} className={`sidebar__item ${active ? "sidebar__item--active" : ""}`}>
                  {active ? (
                    <>
                      <span className="sidebar__indicator" aria-hidden="true" />
                      <span className="sidebar__pill" aria-hidden="true" />
                    </>
                  ) : null}

                  <Link
                    className="sidebar__link"
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setSidebarOpen(false)}
                  >
                    {/* ✅ icon for every row */}
                    <span className="sidebar__icon" aria-hidden="true">
                      {item.icon}
                    </span>
                    <span className="sidebar__label">{item.label}</span>
                  </Link>
                </li>
              );
            })}

            {/* Bottom section */}
            <li className="sidebar__item" style={{ marginTop: 28 }}>
              <Link className="sidebar__link" href="/kairos/settings">
                <span className="sidebar__icon" aria-hidden="true">
                  
                </span>
                <span className="sidebar__label">Settings</span>
              </Link>
            </li>

            {/* ✅ Sign out under settings */}
            <li className="sidebar__item">
              <button className="sidebar__link" type="button" onClick={handleSignOut}>
                <span className="sidebar__icon" aria-hidden="true">
                  
                </span>
                <span className="sidebar__label">Sign out</span>
              </button>
            </li>
          </ul>
        </div>
      </nav>

      {/* Main */}
      <div className="main dashboard__main">
        <header className="topbar" role="banner">
          <button
            className="topbar__menu"
            type="button"
            aria-controls="sidebar"
            aria-expanded={sidebarOpen ? "true" : "false"}
            onClick={() => setSidebarOpen((v) => !v)}
          >
            <img
              src="https://www.figma.com/api/mcp/asset/061c034d-e00b-4de6-9e3f-e09fbc3e13e0"
              alt="Open navigation menu"
            />
          </button>

          <form className="topbar__search" role="search" aria-label="Search">
            <img
              className="topbar__search-icon"
              src="https://www.figma.com/api/mcp/asset/037799a1-9efb-4278-b7b1-48b71129928e"
              alt="Search icon"
            />
            <input className="topbar__search-input" type="search" placeholder="Search product, supplier, order" />
          </form>

          <div className="topbar__spacer" aria-hidden="true" />

          <div className="topbar__actions">
            <button className="topbar__notif" type="button" aria-label="Notifications">
              <img
                src="https://www.figma.com/api/mcp/asset/640d7e11-8865-4893-b1ed-cdf2aae42038"
                alt="Notification bell icon"
              />
              <span className="topbar__notif-badge" aria-hidden="true">
                6
              </span>
            </button>

            <div className="topbar__profile" aria-label="User profile">
              <img
                className="topbar__avatar"
                src="https://www.figma.com/api/mcp/asset/bc5ba9ca-1375-42a4-8f7e-06e91ae8c469"
                alt="Profile"
              />
              <div className="topbar__profile-text">
                <div className="topbar__name">Kairos</div>
                <div className="topbar__role">Ag Ops</div>
              </div>
            </div>
          </div>
        </header>

        <main className="content">{children}</main>
      </div>

      {/* Overlay (mobile) */}
      <div
        className="overlay"
        id="overlay"
        aria-hidden="true"
        style={{
          opacity: sidebarOpen ? 1 : 0,
          pointerEvents: sidebarOpen ? "auto" : "none",
        }}
        onClick={() => setSidebarOpen(false)}
      />
    </div>
  );
}