package com.ims.csat.dto;

/** Per-analyst CSAT aggregate for reporting. */
public record CsatSummaryRow(
        Long analystId,
        String analystName,
        long ratingCount,
        double averageRating
) {
}
