-- ─────────────────────────────────────────────────────────────────────────────
-- Resolution events: paying the fine vs. curing the violation.
--
-- The LA EBEWE / LAMC enforcement model treats these as TWO INDEPENDENT acts:
--   • Paying the §91.9712 / §98.0411(c) fine SETTLES the money owed but does
--     NOT make the building compliant.
--   • Submitting the benchmarking / A/RCx documentation CURES the underlying
--     non-compliance, but does NOT waive an unpaid fine.
--
-- Curing is already captured by 'benchmark_submitted' / 'arcx_completed'. This
-- migration adds 'fine_paid' so the money axis can be recorded too. A
-- 'fine_paid' event's event_date is the payment date; metadata carries the
-- settled balance at that moment. buildView reads both axes independently.
-- ─────────────────────────────────────────────────────────────────────────────

alter type compliance_event_type add value if not exists 'fine_paid';
