import { Sparkles, FileText, ShieldCheck, MessageSquareWarning } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";

export default function AssistantPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 lg:p-8">
      <PageHeader
        title="Compliance assistant"
        description="The one narrowly scoped AI component — coming after the deterministic core."
      />

      <Card>
        <CardContent className="pt-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-muted">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">Planned for Phase 2</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Everything in Verdify today — deadlines, the A/RCx cycle, fine math —
            is pure rule execution and cannot hallucinate. The assistant is the
            only AI surface, and it is deliberately bounded.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: FileText, title: "RAG-bounded", body: "Retrieval over EBEWE ordinance + LAMC enforcement text only." },
          { icon: ShieldCheck, title: "Always cited", body: "Every answer carries a citation to the relevant code section." },
          { icon: MessageSquareWarning, title: "Escalates", body: "Ambiguous questions defer to 'consult your energy consultant.'" },
        ].map((f) => (
          <div key={f.title} className="rounded-lg border border-border bg-card p-4">
            <f.icon className="h-5 w-5 text-primary" />
            <h3 className="mt-2 text-sm font-semibold">{f.title}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
