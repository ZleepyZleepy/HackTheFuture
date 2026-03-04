"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

export default function KairosShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  const dashboardClass = useMemo(() => {
    return sidebarOpen ? "dashboard dashboard--sidebar-open" : "dashboard";
  }, [sidebarOpen]);

  function isActive(href: string) {
    if (href === "/kairos") return pathname === "/kairos";
    return pathname.startsWith(href);
  }

  return (
    <>
      <div className={dashboardClass} id="app">
        <nav className="sidebar dashboard__sidebar" id="sidebar" aria-label="Sidebar Navigation">
          <div className="sidebar__logo" aria-label="Kairos Logo">
            <span>Kai</span>
            <span>ros</span>
          </div>

          <hr className="sidebar__divider sidebar__divider--top" />
          <div className="sidebar__section-label">PAGES</div>
          <hr className="sidebar__divider sidebar__divider--bottom" />

          <div className="sidebar__nav">
            <ul className="sidebar__list">
              <li className={`sidebar__item ${isActive("/kairos") ? "sidebar__item--active" : ""}`}>
                {isActive("/kairos") ? (
                  <>
                    <span className="sidebar__indicator" aria-hidden="true"></span>
                    <span className="sidebar__pill" aria-hidden="true"></span>
                  </>
                ) : null}

                <Link className="sidebar__link" href="/kairos" aria-current={isActive("/kairos") ? "page" : undefined}>
                  <span className="sidebar__icon" aria-hidden="true">
                    
                  </span>
                  <span className="sidebar__label">Dashboard</span>
                </Link>
              </li>

              <li className={`sidebar__item ${isActive("/kairos/analysis") ? "sidebar__item--active" : ""}`}>
                {isActive("/kairos/analysis") ? (
                  <>
                    <span className="sidebar__indicator" aria-hidden="true"></span>
                    <span className="sidebar__pill" aria-hidden="true"></span>
                  </>
                ) : null}

                <Link className="sidebar__link" href="/kairos/analysis">
                  <span className="sidebar__icon" aria-hidden="true">
                    
                  </span>
                  <span className="sidebar__label">Analysis</span>
                </Link>
              </li>

              <li className={`sidebar__item ${isActive("/kairos/data") ? "sidebar__item--active" : ""}`}>
                {isActive("/kairos/data") ? (
                  <>
                    <span className="sidebar__indicator" aria-hidden="true"></span>
                    <span className="sidebar__pill" aria-hidden="true"></span>
                  </>
                ) : null}

                <Link className="sidebar__link" href="/kairos/data">
                  <span className="sidebar__icon" aria-hidden="true">
                    
                  </span>
                  <span className="sidebar__label">Data Upload</span>
                </Link>
              </li>

              <li className={`sidebar__item ${isActive("/kairos/sources") ? "sidebar__item--active" : ""}`}>
                {isActive("/kairos/sources") ? (
                  <>
                    <span className="sidebar__indicator" aria-hidden="true"></span>
                    <span className="sidebar__pill" aria-hidden="true"></span>
                  </>
                ) : null}

                <Link className="sidebar__link" href="/kairos/sources">
                  <span className="sidebar__icon" aria-hidden="true">
                    
                  </span>
                  <span className="sidebar__label">Insider Sources</span>
                </Link>
              </li>

              <li className={`sidebar__item ${isActive("/kairos/history") ? "sidebar__item--active" : ""}`}>
                {isActive("/kairos/history") ? (
                  <>
                    <span className="sidebar__indicator" aria-hidden="true"></span>
                    <span className="sidebar__pill" aria-hidden="true"></span>
                  </>
                ) : null}

                <Link className="sidebar__link" href="/kairos/history">
                  <span className="sidebar__icon" aria-hidden="true">
                    
                  </span>
                  <span className="sidebar__label">Run History</span>
                </Link>
              </li>

              <li className="sidebar__item" style={{ marginTop: 33 }}>
                <Link className="sidebar__link" href="/kairos/settings">
                  <span className="sidebar__icon" aria-hidden="true">
                    
                  </span>
                  <span className="sidebar__label">Settings</span>
                </Link>
              </li>
            </ul>
          </div>
        </nav>

        <div className="main dashboard__main">
          <header className="topbar" role="banner">
            <button
              className="topbar__menu"
              type="button"
              aria-controls="sidebar"
              aria-expanded={sidebarOpen}
              onClick={() => setSidebarOpen((v) => !v)}
            >
              <img
                src="https://www.figma.com/api/mcp/asset/061c034d-e00b-4de6-9e3f-e09fbc3e13e0"
                alt="Open navigation menu"
              />
            </button>

            <form className="topbar__search" role="search" aria-label="Search" onSubmit={(e) => e.preventDefault()}>
              <img
                className="topbar__search-icon"
                src="https://www.figma.com/api/mcp/asset/037799a1-9efb-4278-b7b1-48b71129928e"
                alt="Search icon"
              />
              <input className="topbar__search-input" type="search" placeholder="Search" aria-label="Search" />
            </form>

            <div className="topbar__spacer" aria-hidden="true"></div>

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
                  alt="Profile photo"
                />
                <div className="topbar__profile-text">
                  <div className="topbar__name">Kairos</div>
                  <div className="topbar__role">Ag Ops</div>
                </div>
                <img
                  className="topbar__more"
                  src="https://www.figma.com/api/mcp/asset/09ba95ca-f544-43e0-85c2-806634f68250"
                  alt="More options"
                />
              </div>
            </div>
          </header>

          <main className="content">{children}</main>
        </div>
      </div>

      <div
        className="overlay"
        aria-hidden="true"
        onClick={() => setSidebarOpen(false)}
        style={{
          pointerEvents: sidebarOpen ? "auto" : "none",
          opacity: sidebarOpen ? 1 : 0,
        }}
      />
    </>
  );
}