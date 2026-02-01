# ERP Hardening Verification Checklist

**Plan:** `docs/plans/2026-02-01-erp-hardening-plan.md`
**Completion Date:** 2026-02-01

---

## Phase 0 — Measurement & Tooling ✅

- [x] **Task 1:** Bundle visualizer added (`npm run build:analyze`)
- [x] **Task 2:** Performance budgets documented (`docs/audit/PERF_BUDGETS.md`)

---

## Phase 1 — P0 Performance Fixes ✅

- [x] **Task 3:** Pagination types added (`PageResult<T>`)
- [x] **Task 4:** Paginated documents query (`getDocumentsPage()`)
- [x] **Task 5:** Documents list wired to pagination (50 items/page)
- [x] **Task 6:** Paginated bookings query (`getBookingsPage()`)
- [x] **Task 7:** Bookings list wired to pagination
- [x] **Task 8:** Documents list virtualized (react-window)
- [x] **Task 9:** Bookings list virtualized
- [x] **Task 10:** PDF generation lazy-loaded (446KB chunk now on-demand)

### Bundle Analysis Results

| Metric | Budget | Actual | Status |
|--------|--------|--------|--------|
| JS initial (gzip) | ≤200 kB | 268 kB | ⚠️ Over budget |
| CSS (gzip) | ≤50 kB | 14.5 kB | ✅ Under budget |
| PDF chunk (lazy) | N/A | 131 kB | ✅ Code-split |

---

## Phase 2 — P1 Security & Integrity ✅

- [x] **Task 11:** RLS policies hardened for core tables (024 migration)
- [x] **Task 12:** Sessions RLS fixed (025 migration)
- [x] **Task 13:** Company_id enforced in all mutations
- [x] **Task 14:** Transactional document creation RPC (026 migration)
- [x] **Task 15:** Audit logging moved to database

### Security Coverage

| Table | RLS Before | RLS After |
|-------|-----------|-----------|
| companies | Permissive | Service-role only |
| accounts | Permissive | Service-role only |
| documents | Permissive | Service-role only |
| invoices | Permissive | Service-role only |
| receipts | Permissive | Service-role only |
| payment_vouchers | Permissive | Service-role only |
| statements_of_payment | Permissive | Service-role only |
| line_items | Permissive | Service-role only |
| sessions | Flawed policy | Service-role only |

---

## Phase 3 — P2 Maintainability & UI Consistency ✅

- [x] **Task 16:** ESLint config added (140 issues identified)
- [x] **Task 17:** @ts-nocheck removed from core services (3 files)
- [x] **Task 18:** Table component with sticky header, dense view for documents
- [x] **Task 19:** Unified status badge system (`utils/statusBadges.ts`)
- [x] **Task 20:** Standardized form action bars (`FormActionBar` component)

---

## Phase 4 — Verification ✅

- [x] **Task 21:** Bundle stats collected (see above)
- [ ] **Task 22:** Manual UI performance capture (instructions below)

### Manual Testing Instructions (Task 22)

1. Open Chrome DevTools → Network tab
2. Navigate to Documents list with 100+ documents
3. Verify:
   - Initial page load fetches only 50 documents
   - Pagination controls appear
   - Scrolling is smooth (virtualized)
4. Click "Download PDF" on any document
5. Verify:
   - PDF chunk loads on-demand (check Network tab)
   - No PDF code in initial bundle
6. Save HAR file to `docs/audit/har/` for reference

---

## Commits Summary

| Commit | Description |
|--------|-------------|
| f180916 | chore: add bundle analysis build |
| 9b5c9a8 | docs: add performance budgets |
| 1d81957 | feat: add pagination result type |
| 111553d | feat: add paged document list query |
| (various) | feat: paginate documents/bookings lists |
| (various) | perf: virtualize documents/bookings lists |
| (various) | perf: lazy load PDF generation |
| b7f0b79 | security: harden RLS policies for core tables |
| 0bbfe40 | security: fix sessions RLS policy |
| (various) | security: scope document mutations by company |
| (various) | feat: transactional document creation RPC |
| 3ab6425 | feat: migrate audit logs to database |
| (various) | chore: add eslint config |
| (various) | chore: restore types in core services |
| (various) | ui: add dense table for documents |
| (various) | ui: standardize status badges |
| (various) | ui: standardize form action bars |

---

## Remaining Work

1. **JS Bundle Size:** Main bundle at 268KB gzip exceeds 200KB budget
   - Consider splitting heavy dependencies (date-fns, etc.)
   - Consider route-based code splitting

2. **ESLint Issues:** 140 problems identified (16 errors, 124 warnings)
   - Address incrementally in future sprints

3. **Apply Migrations:** Run migrations 024-026 on production database
