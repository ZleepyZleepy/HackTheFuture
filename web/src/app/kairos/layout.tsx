import "@/app/kairos.css";
import AuthGate from "@/components/AuthGate";
import KairosShell from "@/components/kairos/KairosShell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <KairosShell>{children}</KairosShell>
    </AuthGate>
  );
}