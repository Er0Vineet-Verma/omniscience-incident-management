package com.ims.publicapi;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ims.common.enums.Role;
import com.ims.common.enums.UserStatus;
import com.ims.dashboard.DashboardService;
import com.ims.dashboard.dto.DashboardSummary;
import com.ims.report.ReportService;
import com.ims.report.dto.SlaComplianceReport;
import com.ims.user.UserRepository;

import lombok.RequiredArgsConstructor;

/**
 * Unauthenticated, non-sensitive aggregate stats for the public login screen.
 * Returns only high-level counts (no incident details, names, or PII) so the
 * "Mission Control" panel shows real numbers instead of hardcoded ones. Reuses
 * the same server-side aggregations as the dashboard.
 */
@RestController
@RequestMapping("/api/public")
@RequiredArgsConstructor
public class PublicController {

    private final DashboardService dashboardService;
    private final ReportService reportService;
    private final UserRepository userRepository;

    public record PublicStats(
            long openIncidents,
            long p1Open,
            long totalIncidents,
            double slaCompliancePercent,
            long analystsOnDuty) {
    }

    @GetMapping("/stats")
    public ResponseEntity<PublicStats> stats() {
        DashboardSummary summary = dashboardService.summary();
        SlaComplianceReport sla = reportService.slaCompliance();
        long analysts = userRepository.findByRoleAndStatus(Role.ANALYST, UserStatus.ACTIVE).size();
        return ResponseEntity.ok(new PublicStats(
                summary.openIncidents(),
                summary.p1Open(),
                summary.totalIncidents(),
                Math.round(sla.compliancePercent() * 10.0) / 10.0,
                analysts));
    }
}
