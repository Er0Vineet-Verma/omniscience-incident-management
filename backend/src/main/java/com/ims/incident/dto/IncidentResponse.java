package com.ims.incident.dto;

import java.time.LocalDateTime;

import com.ims.common.enums.IncidentStatus;
import com.ims.common.enums.Priority;
import com.ims.incident.Incident;
import com.ims.user.User;

public record IncidentResponse(
        Long id,
        String incidentNumber,
        String title,
        String description,
        Priority priority,
        IncidentStatus status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        LocalDateTime resolvedAt,
        LocalDateTime closedAt,
        LocalDateTime slaDeadline,
        boolean slaBreached,
        int escalationLevel,
        String resolutionNotes,
        String rootCause,
        Long assignedToId,
        String assignedToName,
        Long createdById,
        String createdByName
) {

    public static IncidentResponse from(Incident incident) {
        User assignedTo = incident.getAssignedTo();
        User createdBy = incident.getCreatedBy();
        return new IncidentResponse(
                incident.getId(),
                incident.getIncidentNumber(),
                incident.getTitle(),
                incident.getDescription(),
                incident.getPriority(),
                incident.getStatus(),
                incident.getCreatedAt(),
                incident.getUpdatedAt(),
                incident.getResolvedAt(),
                incident.getClosedAt(),
                incident.getSlaDeadline(),
                incident.isSlaBreached(),
                incident.getEscalationLevel(),
                incident.getResolutionNotes(),
                incident.getRootCause(),
                assignedTo != null ? assignedTo.getId() : null,
                assignedTo != null ? assignedTo.getName() : null,
                createdBy != null ? createdBy.getId() : null,
                createdBy != null ? createdBy.getName() : null
        );
    }
}
