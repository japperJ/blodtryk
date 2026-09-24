# Adult BP Classification Age Scope

**Status:** Approved design, 2026-09-23

## Context

The app uses the Danish Cardiological Society (DCS) NBV 2026/4 Table 27.1 for its informational blood-pressure categories. That adult-focused source does not establish pediatric thresholds. The app stores a reading age as an optional integer and a profile birth year without a full date of birth or age provenance. A year-derived age of 18 can therefore still represent someone who is 17, and historical age values do not identify whether they were entered or derived.

## Design

- Apply the DCS adult categories to saved readings only when the reading's stored age is **19 or older**. This conservative app eligibility cutoff is not a DCS threshold; it avoids treating an uncertain year-only estimate of 18 as proof of adulthood.
- Return an unclassified result for ages 1–18 and for missing age. Do not infer a pediatric category or show pediatric thresholds or advice.
- Keep every numeric reading, trend point, and historical record. Only its adult-guideline category is suppressed.
- Route category displays and aggregates through the shared classifier: reading cards, dashboard, batch results, statistics API, trends, and PDF exports. The unclassified presentation must explain that adult DCS categories are not applied when the age available to classification is unknown or 18 and below; distinguish this reason from invalid or out-of-table measurements where shown.
- Batch timeline intentionally uses `derivedAge` from the currently selected profile, as in the existing scan flow. Profiles store only birth year, so this year-derived value may overestimate age by one before the birthday. Do not add saved-reading age to the batch API or switch batch results to stored reading age. Batch categories therefore follow the selected profile's current year-derived age, unlike saved-history, statistics, and PDF views, which use each reading's stored age. This is an approved product trade-off.
- Preserve the existing DCS categories and thresholds for eligible readings, and keep the presentation informational rather than diagnostic or prescriptive.

## Implementation boundaries

No pediatric guideline, diagnosis or treatment advice, new age-source field, or database migration is in scope. A future change may support exact age provenance and adult classification at age 18, but this design intentionally keeps all recorded age-18 readings unclassified until such provenance exists.

## Validation

Add deterministic classifier tests for unknown age and ages 17, 18, and 19, plus existing DCS category boundaries for eligible ages. Verify every display, aggregate, API, and export uses the same eligibility result. Run the focused classification tests and production build.
