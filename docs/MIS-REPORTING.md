# MIS QA summary feed v1 — development only

`GET /api/mis/v1/qa?academicYear=2026/27&season=S1&division=LS`

Separate dedicated bearer endpoint, GET only. It never calls the staff/admin API, copies seed records, exposes staff observations or writes QA data. Existing UI, QA entry and Harrow tutorial remain in this application, outside MIS.

Disabled unless `QA_MIS_REPORTING_ENABLED=true` **and** `QA_MIS_IT_APPROVED=true`. IT must set a dedicated `QA_MIS_REPORTING_TOKEN` (32+ random characters, different from staff/admin/session/Planner secrets), `QA_MIS_DIVISIONS=LS,US`, and explicit `QA_MIS_STORE_NAME`. The wrapper reads only `activity/`, `review/`, `followup/` stored records with strong consistency, bounded collection counts. No endpoint is enabled by this commit. `QA_MIS_COMPLETE_SNAPSHOT=true` is a separate explicit completeness declaration. QA lacks a native global monotonic revision; envelope revision is currently 0 and MIS binds the complete content digest. IT must supply native snapshot consistency/versioning before live use.

Envelope: `{schemaVersion:1,source:'qa',scope,revision,generatedAt,complete,records,providerAggregates,issues}`. Missing gates 503; failed bearer 401; scope outside approved divisions 400; write method 405. Authentication precedes storage reads.

Only active activities with `misReporting.approved===true`, `misReporting.externalSupported===true`, explicit `misReporting.division` and the existing trusted `plannerSource` year/season/activityId linkage qualify. Reviews/follow-ups require their own `misReporting.approved===true`. Nothing automatically grants reporting approval to existing records. MIS also verifies the reviewed link against an approved **External** Planner activity; activity names are not identifiers.

Record fields: `qaActivityId`, linked `plannerActivityId`, scope, `providerId`, `externalSupported:true`, `approvalStatus:'approved'`, `midSeasonComplete`, `endSeasonComplete`, `observations`.

Each observation has approved review ID, mid/end stage, date, score (1–5), ten coded checklist results (`yes/no/na`), priority, follow-up status and approved structured outstanding actions. Check codes: `register`, `instructions`, `resources`, `staff-role`, `relationships`, `engagement`, `safety`, `behaviour`, `differentiation`, `dismissal`. Actions require `review.misReporting.actionsApproved===true` and explicit `actions:[{id,category,status,dueDate}]`; no free-text narratives are transferred. Follow-ups update status only if separately approved. Invalid approved reviews make the feed incomplete. Provider means are null/suppressed below three approved reviews.

Never exported: reviewer/staff names, private `review`, `nextSteps`, strengths, sessions narrative, owner, contact or staff directory. SEN/EAL classifications are absent. Provider IDs must be stable opaque identifiers for the strict MIS consumer.

Synthetic mapping example: QA `DEMO-QA-FOOTBALL` → existing Planner link `DEMO-PLANNER-FOOTBALL` → reviewed MIS canonical `DEMO-CCA-LS-3` (2026/27, S1, LS). SOCS joins separately by its reviewed stable ID.

Targeted tests: `node --test netlify/lib/mis-reporting.test.mjs` (2 tests). MIS exercises a byte-identical handler with synthetic fixtures and strict DTO validation. The full legacy QA suite/build and Netlify storage wrapper have not been exercised here. Remaining IT work: review approval metadata, a consistent source snapshot/revision adapter, staging store access, external-support ownership, service tokens, hosting/region, monitoring, retention and live connection approval. This development branch is not deployed and does not change main.
