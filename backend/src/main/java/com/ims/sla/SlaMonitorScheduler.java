package com.ims.sla;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.ims.common.enums.IncidentStatus;
import com.ims.escalation.EscalationService;
import com.ims.incident.Incident;
import com.ims.incident.IncidentRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Component
@RequiredArgsConstructor
@Slf4j
public class SlaMonitorScheduler {

    private static final List<IncidentStatus> TERMINAL_STATUSES =
            List.of(IncidentStatus.RESOLVED, IncidentStatus.CLOSED);

    private final IncidentRepository incidentRepository;
    private final EscalationService escalationService;

    @Value("${app.sla.escalation-l2-minutes}")
    private long escalationL2Minutes;

    @Value("${app.sla.escalation-l3-minutes}")
    private long escalationL3Minutes;

    /** Last time the sweep ran and how many overdue incidents it found (surfaced on the Infra screen). */
    private volatile LocalDateTime lastSweepAt;
    private volatile int lastSweepOverdueCount;

    @Scheduled(fixedRateString = "60000", initialDelayString = "30000")
    @Transactional
    public void monitorSla() {
        try {
            LocalDateTime now = LocalDateTime.now();
            List<Incident> overdueIncidents =
                    incidentRepository.findByStatusNotInAndSlaDeadlineBefore(TERMINAL_STATUSES, now);

            for (Incident incident : overdueIncidents) {
                try {
                    processOverdueIncident(incident, now);
                } catch (Exception e) {
                    log.error("SLA monitor failed to process incident {}: {}",
                            incident.getIncidentNumber(), e.getMessage(), e);
                }
            }

            if (!overdueIncidents.isEmpty()) {
                incidentRepository.saveAll(overdueIncidents);
            }
            this.lastSweepAt = now;
            this.lastSweepOverdueCount = overdueIncidents.size();
        } catch (Exception e) {
            log.error("SLA monitor tick failed: {}", e.getMessage(), e);
        }
    }

    public LocalDateTime getLastSweepAt() {
        return lastSweepAt;
    }

    public int getLastSweepOverdueCount() {
        return lastSweepOverdueCount;
    }

    private void processOverdueIncident(Incident incident, LocalDateTime now) {
        if (!incident.isSlaBreached()) {
            incident.setSlaBreached(true);
            log.warn("SLA ALERT: incident {} ({}) breached SLA deadline {}",
                    incident.getIncidentNumber(), incident.getPriority(), incident.getSlaDeadline());
            escalationService.escalate(incident, 1,
                    "SLA breached: " + incident.getPriority() + " unresolved past deadline");
            return;
        }

        long minutesPastDeadline = Duration.between(incident.getSlaDeadline(), now).toMinutes();
        if (minutesPastDeadline >= escalationL3Minutes && incident.getEscalationLevel() < 3) {
            log.warn("SLA ALERT: incident {} unresolved {} minutes past SLA deadline - escalating to level 3",
                    incident.getIncidentNumber(), minutesPastDeadline);
            escalationService.escalate(incident, 3,
                    "Unresolved " + minutesPastDeadline + " minutes past SLA deadline");
        } else if (minutesPastDeadline >= escalationL2Minutes && incident.getEscalationLevel() < 2) {
            log.warn("SLA ALERT: incident {} unresolved {} minutes past SLA deadline - escalating to level 2",
                    incident.getIncidentNumber(), minutesPastDeadline);
            escalationService.escalate(incident, 2,
                    "Unresolved " + minutesPastDeadline + " minutes past SLA deadline");
        }
    }
}
