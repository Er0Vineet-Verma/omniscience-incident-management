package com.ims.report.dto;

public record AnalystReport(
        Long analystId,
        String analystName,
        String email,
        long assignedTotal,
        long openNow,
        long resolvedTotal,
        double avgResolutionHours,
        double slaCompliancePercent,
        long p1OpenCount
) {
}
