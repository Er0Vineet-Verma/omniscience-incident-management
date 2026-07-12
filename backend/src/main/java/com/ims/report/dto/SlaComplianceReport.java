package com.ims.report.dto;

import java.util.List;

public record SlaComplianceReport(
        long totalResolved,
        long resolvedWithinSla,
        long breached,
        double compliancePercent,
        List<SlaPriorityRow> byPriority
) {
}
