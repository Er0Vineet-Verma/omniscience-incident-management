package com.ims.report.dto;

public record SlaPriorityRow(
        String priority,
        long total,
        long withinSla,
        double compliancePercent
) {
}
