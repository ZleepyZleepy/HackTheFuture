import "./globals.css";
import Link from "next/link";
import UserMenu from "@/components/UserMenu";

export const metadata = {
  title: "Project Name",
  description: "BOM Substitution & Re-Qualification Resilience Agent",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <header className="border-b bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-gray-900" />
              <div>
                <div className="text-sm font-semibold leading-4">Project Name</div>
                <div className="text-xs text-gray-500">
                  Resilience agent for BOM substitutes
                </div>
              </div>
            </div>

            <nav className="flex items-center gap-4 text-sm">
              <Link className="hover:underline" href="/radar">
                Radar
              </Link>
              <Link className="hover:underline" href="/event/evt_001">
                Event
              </Link>
              <Link className="hover:underline" href="/memory">
                Memory
              </Link>
            </nav>
            <UserMenu />
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-6 py-6">{children}</main>
      </body>
    </html>
  );
}