package com.ims.dashboard;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.ims.dashboard.dto.ChartSlice;
import com.ims.dashboard.dto.DashboardSummary;
import com.ims.dashboard.dto.SlaBuckets;
import com.ims.dashboard.dto.TrendPoint;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ANALYST','ADMIN')") // global aggregates — never exposed to CUSTOMER
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping("/summary")
    public ResponseEntity<DashboardSummary> summary() {
        return ResponseEntity.ok(dashboardService.summary());
    }

    @GetMapping("/priority-distribution")
    public ResponseEntity<List<ChartSlice>> priorityDistribution() {
        return ResponseEntity.ok(dashboardService.priorityDistribution());
    }

    @GetMapping("/status-distribution")
    public ResponseEntity<List<ChartSlice>> statusDistribution() {
        return ResponseEntity.ok(dashboardService.statusDistribution());
    }

    @GetMapping("/trends")
    public ResponseEntity<List<TrendPoint>> trends(
            @RequestParam(name = "days", defaultValue = "14") int days) {
        return ResponseEntity.ok(dashboardService.trends(days));
    }

    @GetMapping("/sla-buckets")
    public ResponseEntity<SlaBuckets> slaBuckets() {
        return ResponseEntity.ok(dashboardService.slaBuckets());
    }

    @GetMapping("/heatmap")
    public ResponseEntity<int[][]> heatmap(
            @RequestParam(name = "days", defaultValue = "28") int days) {
        return ResponseEntity.ok(dashboardService.heatmap(days));
    }
}
