import Link from "next/link";
import { ShieldCheck, Clock, Calculator, FolderLock, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const FEATURES = [
  { icon: Building2, title: "Building onboarding", body: "Enter a LADBS Building ID — the full compliance schedule and five-year A/RCx cycle derive automatically." },
  { icon: ShieldCheck, title: "Portfolio dashboard", body: "Every covered building as a live status tile with a compounding fine-exposure counter." },
  { icon: Clock, title: "Deadline engine", body: "Countdown timers with 90-, 30-, and 7-day multi-channel alerts. No model — pure rules." },
  { icon: Calculator, title: "Alert simulator", body: "Model the cost of a missed deadline including the full LAMC 98.0411(c) escalation." },
  { icon: FolderLock, title: "Document vault", body: "Every benchmarking submission, A/RCx report, and lender-ready packet in one audit-ready place." },
];

export default function Home() {
  return (
    <main className="flex-1">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <span className="text-lg font-semibold tracking-tight">Verdify</span>
          </div>
          <Link href="/login">
            <Button size="sm">Sign in</Button>
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <p className="text-sm font-medium text-primary">
          Ordinance-native EBEWE compliance · Los Angeles
        </p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Continuous, audit-ready compliance across your entire portfolio.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
          Verdify collapses LADBS, LADWP, and EPA Portfolio Manager into one
          environment — automated deadlines, live fine-exposure tracking, and a
          lender-ready document vault. The deadline math is hard-coded from the
          ordinance, so it can&apos;t hallucinate a wrong date.
        </p>
        <div className="mt-8 flex gap-3">
          <Link href="/login">
            <Button size="lg">Open the platform</Button>
          </Link>
          <Link href="/dashboard">
            <Button size="lg" variant="outline">
              View portfolio dashboard
            </Button>
          </Link>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-lg border border-border bg-card p-5">
              <f.icon className="h-5 w-5 text-primary" />
              <h3 className="mt-3 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
