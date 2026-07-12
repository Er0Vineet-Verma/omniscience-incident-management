package com.ims.audit.dto;

/**
 * Aggregated audit metrics for the Audit Center header cards. All counts are
 * computed in the database (no client sampling), consistent with the dashboard
 * aggregation endpoints.
 */
public record AuditStats(
        long totalEvents,
        long eventsToday,
        long escalations,
        long resolved,
        long deletions,
        long distinctActors) {
}
