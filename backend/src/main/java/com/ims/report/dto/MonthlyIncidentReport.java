package com.ims.report.dto;

import java.util.Map;

public record MonthlyIncidentReport(
        int year,
        int month,
        long totalCreated,
        long totalResolved,
        long totalClosed,
        Map<String, Long> byPriority,
        Map<String, Long> byStatus,
        double slaCompliancePercent
) {
}
