import { cn } from "./utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-gray-200 animate-pulse rounded-md", className)}
      {...props}
    />
  );
}

// ============================================================================
// SKELETON VARIANTS FOR DIFFERENT CONTENT TYPES
// ============================================================================

/**
 * Skeleton for a single booking card in the booking list
 */
function SkeletonBookingCard() {
  return (
    <div className="border rounded-lg p-4 space-y-4">
      {/* Header row: booking code + status badge */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" /> {/* Booking code */}
          <Skeleton className="h-4 w-48" /> {/* Guest name */}
        </div>
        <Skeleton className="h-6 w-20 rounded-full" /> {/* Status badge */}
      </div>

      {/* Trip details row */}
      <div className="flex gap-4">
        <Skeleton className="h-4 w-24" /> {/* Country */}
        <Skeleton className="h-4 w-32" /> {/* Date range */}
        <Skeleton className="h-4 w-16" /> {/* Pax count */}
      </div>

      {/* Financial metrics row */}
      <div className="grid grid-cols-3 gap-4 pt-3 border-t">
        <div className="space-y-1">
          <Skeleton className="h-3 w-16" /> {/* Label */}
          <Skeleton className="h-5 w-24" /> {/* Value */}
        </div>
        <div className="space-y-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-5 w-24" />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-5 w-24" />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex justify-end gap-2 pt-3 border-t">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 w-16" />
      </div>
    </div>
  );
}

/**
 * Skeleton for multiple booking cards
 */
function SkeletonBookingList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonBookingCard key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton for a single document card
 */
function SkeletonDocumentCard() {
  return (
    <div className="border rounded-lg p-4 space-y-3">
      {/* Header: icon + document number + status */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-5 rounded" /> {/* Icon */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-28" /> {/* Document number */}
              <Skeleton className="h-5 w-16 rounded-full" /> {/* Status badge */}
            </div>
            <Skeleton className="h-3 w-36" /> {/* Customer/Payee name */}
          </div>
        </div>
        <div className="text-right space-y-1">
          <Skeleton className="h-5 w-24" /> {/* Amount */}
          <Skeleton className="h-3 w-16" /> {/* Country flag */}
        </div>
      </div>

      {/* Date and currency row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-3 w-20" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-3 w-12" />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex justify-between items-center pt-3 border-t">
        <Skeleton className="h-3 w-40" /> {/* ID */}
        <div className="flex gap-2">
          <Skeleton className="h-8 w-14" />
          <Skeleton className="h-8 w-14" />
          <Skeleton className="h-8 w-16" />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for multiple document cards
 */
function SkeletonDocumentList({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonDocumentCard key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton for the document list with tabs
 */
function SkeletonDocumentListWithTabs() {
  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      {/* Card Header */}
      <div className="flex flex-col space-y-1.5 p-6">
        <Skeleton className="h-6 w-36" /> {/* "Documents (X)" title */}
      </div>

      {/* Card Content */}
      <div className="p-6 pt-0">
        {/* Tabs */}
        <div className="mb-4">
          <div className="inline-flex h-10 items-center justify-center rounded-md bg-gray-100 p-1 w-full">
            <Skeleton className="h-8 flex-1 rounded-sm" />
            <Skeleton className="h-8 flex-1 rounded-sm mx-1" />
            <Skeleton className="h-8 flex-1 rounded-sm mx-1" />
            <Skeleton className="h-8 flex-1 rounded-sm mx-1" />
            <Skeleton className="h-8 flex-1 rounded-sm" />
          </div>
        </div>

        {/* Document list */}
        <SkeletonDocumentList count={4} />
      </div>
    </div>
  );
}

/**
 * Skeleton for dashboard stats cards
 */
function SkeletonStatsCard() {
  return (
    <div className="rounded-lg border bg-card p-6 space-y-2">
      <Skeleton className="h-4 w-24" /> {/* Label */}
      <Skeleton className="h-8 w-32" /> {/* Value */}
      <Skeleton className="h-3 w-20" /> {/* Subtitle */}
    </div>
  );
}

/**
 * Skeleton for dashboard overview
 */
function SkeletonDashboard() {
  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SkeletonStatsCard />
        <SkeletonStatsCard />
        <SkeletonStatsCard />
        <SkeletonStatsCard />
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SkeletonDocumentListWithTabs />
        <div className="space-y-4">
          <Skeleton className="h-6 w-32" />
          <SkeletonBookingList count={2} />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for table rows (e.g., activity logs, transactions)
 */
function SkeletonTableRow() {
  return (
    <div className="flex items-center space-x-4 py-3 border-b">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-4 w-48 flex-1" />
      <Skeleton className="h-4 w-20" />
    </div>
  );
}

/**
 * Skeleton for a table with header and rows
 */
function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-1">
      {/* Table header */}
      <div className="flex items-center space-x-4 py-3 border-b-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-48 flex-1" />
        <Skeleton className="h-4 w-20" />
      </div>
      {/* Table rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonTableRow key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton for account cards in account management
 */
function SkeletonAccountCard() {
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" /> {/* Icon */}
          <div className="space-y-1">
            <Skeleton className="h-5 w-32" /> {/* Account name */}
            <Skeleton className="h-3 w-20" /> {/* Account type */}
          </div>
        </div>
        <div className="text-right space-y-1">
          <Skeleton className="h-6 w-28" /> {/* Balance */}
          <Skeleton className="h-3 w-16" /> {/* Currency */}
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for account list
 */
function SkeletonAccountList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonAccountCard key={i} />
      ))}
    </div>
  );
}

export {
  Skeleton,
  SkeletonBookingCard,
  SkeletonBookingList,
  SkeletonDocumentCard,
  SkeletonDocumentList,
  SkeletonDocumentListWithTabs,
  SkeletonStatsCard,
  SkeletonDashboard,
  SkeletonTableRow,
  SkeletonTable,
  SkeletonAccountCard,
  SkeletonAccountList,
};
