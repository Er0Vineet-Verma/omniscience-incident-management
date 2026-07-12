package com.ims.dashboard.dto;

public record DashboardSummary(
        long openIncidents,
        long inProgress,
        long closedToday,
        long slaBreaches,
        long p1Open,
        long totalIncidents,
        long totalLogs,
        long errorLogs
) {
}
