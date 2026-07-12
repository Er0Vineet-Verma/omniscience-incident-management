package com.ims.dashboard;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ims.common.enums.IncidentStatus;
import com.ims.common.enums.LogLevel;
import com.ims.common.enums.Priority;
import com.ims.dashboard.dto.ChartSlice;
import com.ims.dashboard.dto.DashboardSummary;
import com.ims.dashboard.dto.SlaBuckets;
import com.ims.dashboard.dto.TrendPoint;
import com.ims.incident.Incident;
import com.ims.incident.IncidentRepository;
import com.ims.logs.LogEntryRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private static final List<IncidentStatus> TERMINAL_STATUSES =
            List.of(IncidentStatus.RESOLVED, IncidentStatus.CLOSED);

    private final IncidentRepository incidentRepository;
    private final LogEntryRepository logEntryRepository;

    @Transactional(readOnly = true)
    public DashboardSummary summary() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime startOfToday = LocalDate.now().atStartOfDay();

        long openIncidents = incidentRepository.countByStatus(IncidentStatus.OPEN);
        long inProgress = incidentRepository.countByStatus(IncidentStatus.IN_PROGRESS);
        long closedToday = incidentRepository.countByStatusAndClosedAtBetween(
                IncidentStatus.CLOSED, startOfToday, now);
        long slaBreaches = incidentRepository.countBySlaBreachedTrueAndStatusNotIn(TERMINAL_STATUSES);
        long p1Open = incidentRepository.countByPriorityAndStatusNotIn(Priority.P1, TERMINAL_STATUSES);
        long totalIncidents = incidentRepository.count();
        long totalLogs = logEntryRepository.count();
        long errorLogs = logEntryRepository.countByLogLevel(LogLevel.ERROR);

        return new DashboardSummary(openIncidents, inProgress, closedToday, slaBreaches,
                p1Open, totalIncidents, totalLogs, errorLogs);
    }

    @Transactional(readOnly = true)
    public List<ChartSlice> priorityDistribution() {
        List<ChartSlice> slices = new ArrayList<>();
        for (Priority priority : Priority.values()) {
            slices.add(new ChartSlice(priority.name(), incidentRepository.countByPriority(priority)));
        }
        return slices;
    }

    @Transactional(readOnly = true)
    public List<ChartSlice> statusDistribution() {
        List<ChartSlice> slices = new ArrayList<>();
        for (IncidentStatus status : IncidentStatus.values()) {
            slices.add(new ChartSlice(status.name(), incidentRepository.countByStatus(status)));
        }
        return slices;
    }

    /** SLA health buckets over every active incident — risk = within 60 minutes of deadline. */
    @Transactional(readOnly = true)
    public SlaBuckets slaBuckets() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime riskHorizon = now.plusMinutes(60);
        long healthy = 0;
        long risk = 0;
        long fail = 0;
        for (Incident incident : incidentRepository.findByStatusNotIn(TERMINAL_STATUSES)) {
            LocalDateTime deadline = incident.getSlaDeadline();
            if (incident.isSlaBreached() || (deadline != null && deadline.isBefore(now))) {
                fail++;
            } else if (deadline != null && deadline.isBefore(riskHorizon)) {
                risk++;
            } else {
                healthy++;
            }
        }
        return new SlaBuckets(healthy, risk, fail);
    }

    /** 7x24 incident-creation density (Monday-first rows) over the last {@code days} days. */
    @Transactional(readOnly = true)
    public int[][] heatmap(int days) {
        if (days < 1) {
            days = 28;
        }
        LocalDateTime since = LocalDate.now().minusDays(days - 1L).atStartOfDay();
        int[][] grid = new int[7][24];
        for (Incident incident : incidentRepository.findByCreatedAtBetween(since, LocalDateTime.now())) {
            LocalDateTime created = incident.getCreatedAt();
            if (created != null) {
                grid[created.getDayOfWeek().getValue() - 1][created.getHour()]++;
            }
        }
        return grid;
    }

    @Transactional(readOnly = true)
    public List<TrendPoint> trends(int days) {
        if (days < 1) {
            days = 14;
        }
        LocalDate today = LocalDate.now();
        LocalDate firstDay = today.minusDays(days - 1L);
        LocalDateTime windowStart = firstDay.atStartOfDay();
        LocalDateTime windowEnd = today.plusDays(1).atStartOfDay();

        List<Incident> incidents = incidentRepository.findByCreatedAtBetween(windowStart, windowEnd);

        Map<LocalDate, Long> createdByDay = incidents.stream()
                .filter(incident -> incident.getCreatedAt() != null)
                .collect(Collectors.groupingBy(
                        incident -> incident.getCreatedAt().toLocalDate(),
                        Collectors.counting()));

        Map<LocalDate, Long> resolvedByDay = incidents.stream()
                .map(Incident::getResolvedAt)
                .filter(resolvedAt -> resolvedAt != null
                        && !resolvedAt.isBefore(windowStart)
                        && resolvedAt.isBefore(windowEnd))
                .collect(Collectors.groupingBy(
                        LocalDateTime::toLocalDate,
                        Collectors.counting()));

        List<TrendPoint> points = new ArrayList<>();
        for (int i = 0; i < days; i++) {
            LocalDate day = firstDay.plusDays(i);
            points.add(new TrendPoint(
                    day.toString(),
                    createdByDay.getOrDefault(day, 0L),
                    resolvedByDay.getOrDefault(day, 0L)));
        }
        return points;
    }
}
