package com.ims.report;

import java.time.LocalDate;
import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.ims.report.dto.AnalystReport;
import com.ims.report.dto.MonthlyIncidentReport;
import com.ims.report.dto.SlaComplianceReport;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;

    @GetMapping("/monthly")
    @PreAuthorize("hasAnyRole('ANALYST','ADMIN')")
    public ResponseEntity<MonthlyIncidentReport> monthly(
            @RequestParam(name = "year", required = false) Integer year,
            @RequestParam(name = "month", required = false) Integer month) {
        LocalDate today = LocalDate.now();
        int reportYear = year != null ? year : today.getYear();
        int reportMonth = month != null ? month : today.getMonthValue();
        return ResponseEntity.ok(reportService.monthly(reportYear, reportMonth));
    }

    @GetMapping("/analysts")
    @PreAuthorize("hasAnyRole('ANALYST','ADMIN')")
    public ResponseEntity<List<AnalystReport>> analysts() {
        return ResponseEntity.ok(reportService.analystReport());
    }

    @GetMapping("/sla-compliance")
    @PreAuthorize("hasAnyRole('ANALYST','ADMIN')")
    public ResponseEntity<SlaComplianceReport> slaCompliance() {
        return ResponseEntity.ok(reportService.slaCompliance());
    }
}
