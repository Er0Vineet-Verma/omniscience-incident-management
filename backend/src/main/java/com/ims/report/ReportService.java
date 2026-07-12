package com.ims.report;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ims.common.enums.IncidentStatus;
import com.ims.common.enums.Priority;
import com.ims.common.enums.Role;
import com.ims.common.exception.BadRequestException;
import com.ims.incident.Incident;
import com.ims.incident.IncidentRepository;
import com.ims.report.dto.AnalystReport;
import com.ims.report.dto.MonthlyIncidentReport;
import com.ims.report.dto.SlaComplianceReport;
import com.ims.report.dto.SlaPriorityRow;
import com.ims.user.User;
import com.ims.user.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ReportService {

    private static final List<IncidentStatus> TERMINAL_STATUSES =
            List.of(IncidentStatus.RESOLVED, IncidentStatus.CLOSED);

    private final IncidentRepository incidentRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public MonthlyIncidentReport monthly(int year, int month) {
        if (month < 1 || month > 12) {
            throw new BadRequestException("Month must be between 1 and 12");
        }
        if (year < 1970 || year > 9999) {
            throw new BadRequestException("Year must be between 1970 and 9999");
        }

        LocalDateTime start = LocalDateTime.of(year, month, 1, 0, 0);
        LocalDateTime end = start.plusMonths(1);

        List<Incident> incidents = incidentRepository.findByCreatedAtBetween(start, end);

        long totalCreated = incidents.size();
        long totalResolved = incidents.stream()
                .filter(incident -> incident.getResolvedAt() != null)
                .count();
        long totalClosed = incidents.stream()
                .filter(incident -> incident.getClosedAt() != null)
                .count();

        Map<String, Long> byPriority = new LinkedHashMap<>();
        for (Priority priority : Priority.values()) {
            byPriority.put(priority.name(), incidents.stream()
                    .filter(incident -> incident.getPriority() == priority)
                    .count());
        }

        Map<String, Long> byStatus = new LinkedHashMap<>();
        for (IncidentStatus status : IncidentStatus.values()) {
            byStatus.put(status.name(), incidents.stream()
                    .filter(incident -> incident.getStatus() == status)
                    .count());
        }

        List<Incident> resolved = incidents.stream()
                .filter(incident -> incident.getResolvedAt() != null)
                .collect(Collectors.toList());
        long withinSla = resolved.stream()
                .filter(ReportService::isWithinSla)
                .count();
        double slaCompliancePercent = percent(withinSla, resolved.size());

        return new MonthlyIncidentReport(year, month, totalCreated, totalResolved, totalClosed,
                byPriority, byStatus, slaCompliancePercent);
    }

    @Transactional(readOnly = true)
    public List<AnalystReport> analystReport() {
        List<User> analysts = userRepository.findByRole(Role.ANALYST);
        List<AnalystReport> reports = new ArrayList<>();

        for (User analyst : analysts) {
            List<Incident> assigned = incidentRepository.findByAssignedTo(analyst);
            long assignedTotal = assigned.size();
            long openNow = assigned.stream()
                    .filter(incident -> !TERMINAL_STATUSES.contains(incident.getStatus()))
                    .count();

            List<Incident> resolved = assigned.stream()
                    .filter(incident -> incident.getResolvedAt() != null)
                    .collect(Collectors.toList());
            long resolvedTotal = resolved.size();

            double avgResolutionHours = 0.0;
            if (!resolved.isEmpty()) {
                double totalHours = resolved.stream()
                        .filter(incident -> incident.getCreatedAt() != null)
                        .mapToDouble(incident -> Duration
                                .between(incident.getCreatedAt(), incident.getResolvedAt())
                                .toSeconds() / 3600.0)
                        .sum();
                long counted = resolved.stream()
                        .filter(incident -> incident.getCreatedAt() != null)
                        .count();
                if (counted > 0) {
                    avgResolutionHours = round2(totalHours / counted);
                }
            }

            long withinSla = resolved.stream()
                    .filter(ReportService::isWithinSla)
                    .count();
            double slaCompliancePercent = percent(withinSla, resolvedTotal);
            long p1OpenCount = assigned.stream()
                    .filter(incident -> incident.getPriority() == Priority.P1
                            && !TERMINAL_STATUSES.contains(incident.getStatus()))
                    .count();

            reports.add(new AnalystReport(analyst.getId(), analyst.getName(), analyst.getEmail(),
                    assignedTotal, openNow, resolvedTotal, avgResolutionHours,
                    slaCompliancePercent, p1OpenCount));
        }
        return reports;
    }

    @Transactional(readOnly = true)
    public SlaComplianceReport slaCompliance() {
        List<Incident> resolved = incidentRepository.findByResolvedAtIsNotNull();

        long totalResolved = resolved.size();
        long resolvedWithinSla = resolved.stream()
                .filter(ReportService::isWithinSla)
                .count();
        long breached = totalResolved - resolvedWithinSla;
        double compliancePercent = percent(resolvedWithinSla, totalResolved);

        List<SlaPriorityRow> byPriority = new ArrayList<>();
        for (Priority priority : Priority.values()) {
            List<Incident> forPriority = resolved.stream()
                    .filter(incident -> incident.getPriority() == priority)
                    .collect(Collectors.toList());
            long total = forPriority.size();
            long withinSla = forPriority.stream()
                    .filter(ReportService::isWithinSla)
                    .count();
            byPriority.add(new SlaPriorityRow(priority.name(), total, withinSla,
                    percent(withinSla, total)));
        }

        return new SlaComplianceReport(totalResolved, resolvedWithinSla, breached,
                compliancePercent, byPriority);
    }

    private static boolean isWithinSla(Incident incident) {
        if (incident.getResolvedAt() == null) {
            return false;
        }
        if (incident.getSlaDeadline() == null) {
            return true;
        }
        return !incident.getResolvedAt().isAfter(incident.getSlaDeadline());
    }

    private static double percent(long part, long total) {
        if (total == 0) {
            return 0.0;
        }
        return round2(part * 100.0 / total);
    }

    private static double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
