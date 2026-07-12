package com.ims.escalation;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ims.audit.AuditService;
import com.ims.common.enums.AuditAction;
import com.ims.common.exception.BadRequestException;
import com.ims.escalation.dto.EscalationResponse;
import com.ims.incident.Incident;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class EscalationService {

    private static final String SYSTEM_USER = "SYSTEM";

    private final EscalationRepository escalationRepository;
    private final AuditService auditService;

    @Transactional
    public Escalation escalate(Incident incident, int level, String reason) {
        String escalatedTo = switch (level) {
            case 1 -> "TEAM_LEAD";
            case 2 -> "MANAGER";
            case 3 -> "CRITICAL_ALERT";
            default -> throw new BadRequestException("Invalid escalation level: " + level);
        };

        Escalation escalation = Escalation.builder()
                .incident(incident)
                .level(level)
                .escalatedTo(escalatedTo)
                .reason(reason)
                .escalatedAt(LocalDateTime.now())
                .build();
        Escalation saved = escalationRepository.save(escalation);

        int oldLevel = incident.getEscalationLevel();
        incident.setEscalationLevel(level);

        auditService.record("INCIDENT", incident.getId(), AuditAction.ESCALATED, "escalationLevel",
                String.valueOf(oldLevel), String.valueOf(level), SYSTEM_USER);

        log.warn("Incident {} escalated to level {} ({}): {}",
                incident.getIncidentNumber(), level, escalatedTo, reason);

        return saved;
    }

    @Transactional(readOnly = true)
    public List<EscalationResponse> getAllEscalations() {
        return escalationRepository.findAllByOrderByEscalatedAtDesc().stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<EscalationResponse> getEscalationsByIncident(Long incidentId) {
        return escalationRepository.findByIncidentIdOrderByEscalatedAtDesc(incidentId).stream()
                .map(this::toResponse)
                .toList();
    }

    private EscalationResponse toResponse(Escalation escalation) {
        return new EscalationResponse(
                escalation.getId(),
                escalation.getIncident().getId(),
                escalation.getIncident().getIncidentNumber(),
                escalation.getLevel(),
                escalation.getEscalatedTo(),
                escalation.getReason(),
                escalation.getEscalatedAt());
    }
}
