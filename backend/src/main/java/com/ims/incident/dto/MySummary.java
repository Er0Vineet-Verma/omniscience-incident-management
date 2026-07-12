package com.ims.incident.dto;

/** Customer-scoped request counts for the Customer Home portal. */
public record MySummary(
        long open,
        long inProgress,
        long pending,
        long resolved,
        long closed,
        long total
) {
}
