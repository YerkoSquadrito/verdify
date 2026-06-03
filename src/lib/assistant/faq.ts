// Hardcoded FAQ content for the (pre-AI) Compliance Assistant.
//
// This is deliberately NOT a model: it is a fixed set of clickable questions
// with hand-written, citation-bearing answers — the prototype stand-in for the
// RAG-bounded assistant described in the product spec (Section II). It mirrors
// that component's two rules: every answer carries a citation to the relevant
// code section, and genuinely ambiguous questions escalate to "consult your
// energy consultant" rather than guess.
//
// Numeric facts are pulled from the deterministic engine's ordinance constants
// so the figures here can never drift from the ones the platform enforces.

import {
  COVERAGE_SQFT_PRIVATE,
  COVERAGE_SQFT_CITY,
  FINE_BASE,
  FINE_AT_DAY_30,
  FINE_LATE_CHARGE_DAY,
  FINE_INTEREST_START_DAY,
  FINE_MONTHLY_INTEREST,
} from "@/lib/compliance";

export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
  citation: string;
  /** Ambiguous / advice-bearing — answer defers to a human expert. */
  escalation?: boolean;
}

const pct = `${FINE_MONTHLY_INTEREST * 100}%`;

export const FAQ: FaqEntry[] = [
  {
    id: "coverage",
    question: "Which buildings are covered by EBEWE?",
    answer: `Privately owned buildings larger than ${COVERAGE_SQFT_PRIVATE.toLocaleString()} sq ft, and city-owned buildings larger than ${COVERAGE_SQFT_CITY.toLocaleString()} sq ft, are covered. Square footage is what determines coverage — it is not a consumption limit. EBEWE is a disclosure ordinance: covered buildings must report their energy and water use, not stay under a usage cap.`,
    citation: "LAMC Div. 97 (Existing Buildings Energy & Water Efficiency)",
  },
  {
    id: "benchmark-deadline",
    question: "When is the annual benchmarking deadline?",
    answer:
      "June 1 every year. By that date you must benchmark the building's energy and water use in EPA ENERGY STAR Portfolio Manager and report it to LADBS. The deadline is the same for every covered building — it is not keyed to your Building ID.",
    citation: "LAMC §91.9708.1",
  },
  {
    id: "arcx-year",
    question: "How is my A/RCx compliance year determined?",
    answer:
      "By the last digit of your LADBS Building Identification Number. A/RCx is due once every five years, on December 1 of your assigned year — for example, IDs ending in 6 or 7 were due December 1, 2024, then 2029, and so on. Verdify derives your exact cycle automatically on the building's page.",
    citation: "LAMC §91.9708, Table 9708.2",
  },
  {
    id: "what-is-arcx",
    question: "What is A/RCx?",
    answer:
      "Audit & Retro-Commissioning: every five years a covered building must complete either an ASHRAE Level II energy audit or a retro-commissioning of its systems, performed by a qualified professional, and file the results with LADBS. It is separate from — and on a different date than — the annual June 1 benchmarking.",
    citation: "LAMC §91.9706 / §91.9708",
  },
  {
    id: "missed-deadline",
    question: "What happens if I miss a deadline?",
    answer: `LADBS issues a violation notice and the building is listed publicly as non-compliant. The fee starts at $${FINE_BASE} and, if unpaid within ${FINE_LATE_CHARGE_DAY} days, a 250% combined late charge takes it to $${FINE_AT_DAY_30}. From day ${FINE_INTEREST_START_DAY}, ${pct} per month compounding interest accrues on that balance.`,
    citation: "LAMC §91.9712 and §98.0411(c)",
  },
  {
    id: "pay-vs-comply",
    question: "Does paying the fine make my building compliant?",
    answer:
      "No — and this is the most important distinction. Paying the violation notice settles the money owed, but the building stays non-compliant until you actually submit the required benchmarking or A/RCx documentation. They are two separate steps: settle the fine on the money side, and file the documents to cure the violation. In Verdify, 'Pay fine' and 'Submit compliance documentation' are deliberately separate actions for exactly this reason.",
    citation: "LAMC §91.9712 / §98.0411(c)",
  },
  {
    id: "where-submit",
    question: "Where do I submit my benchmarking data?",
    answer:
      "You enter consumption data in EPA ENERGY STAR Portfolio Manager, then report the benchmarking result to LADBS through the EBEWE portal. Verdify's Benchmarking Pipeline pre-fills the Portfolio Manager submission from utility data so you audit it rather than key it in by hand.",
    citation: "LAMC §91.9708.1",
  },
  {
    id: "escalation-schedule",
    question: "What is the full fine escalation schedule?",
    answer: `Day 0: $${FINE_BASE} base violation notice. Day ${FINE_LATE_CHARGE_DAY}: $${FINE_AT_DAY_30} after the 250% combined late charge. Day ${FINE_INTEREST_START_DAY}: ${pct}/month compounding interest begins on the $${FINE_AT_DAY_30} balance, reaching roughly $780 after a year. The Alert Simulator models this exact curve for any building and any missed date.`,
    citation: "LAMC §98.0411(c)",
  },
  {
    id: "exemption",
    question: "Can my building qualify for an exemption or extension?",
    answer:
      "There are narrow exemption and adjustment pathways (for example certain low-occupancy, financial-hardship, or qualifying-condition cases), but eligibility is fact-specific and depends on your building's circumstances and documentation. This isn't something to guess at — consult your energy consultant or LADBS to confirm whether your building qualifies before relying on it.",
    citation: "Escalated — consult your energy consultant",
    escalation: true,
  },
];
