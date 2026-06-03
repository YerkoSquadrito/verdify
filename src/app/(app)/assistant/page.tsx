import { FileText, ShieldCheck, MessageSquareWarning } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { FaqChat } from "@/components/assistant/FaqChat";

export default function AssistantPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 lg:p-8">
      <PageHeader
        title="Compliance assistant"
        description="Cited answers to the most common EBEWE questions — the bounded stand-in for the RAG assistant."
      />

      <FaqChat />

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: FileText, title: "RAG-bounded", body: "Production version retrieves over EBEWE ordinance + LAMC enforcement text only." },
          { icon: ShieldCheck, title: "Always cited", body: "Every answer carries a citation to the relevant code section." },
          { icon: MessageSquareWarning, title: "Escalates", body: "Ambiguous, building-specific questions defer to 'consult your energy consultant.'" },
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
