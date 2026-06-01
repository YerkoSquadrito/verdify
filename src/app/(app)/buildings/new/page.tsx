import { PageHeader } from "@/components/shared/PageHeader";
import { BinLookupForm } from "@/components/onboarding/BinLookupForm";

export default function NewBuildingPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 lg:p-8">
      <PageHeader
        title="Add a building"
        description="Enter a LADBS Building ID. Verdify looks it up in LA Open Data and derives the full compliance schedule — including the five-year A/RCx cycle keyed to the BIN's last digit. Manual entry always works as a fallback."
      />
      <BinLookupForm />
    </div>
  );
}
