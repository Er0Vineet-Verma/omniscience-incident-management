package com.ims.escalation.dto;

import java.time.LocalDateTime;

public record EscalationResponse(
        Long id,
        Long incidentId,
        String incidentNumber,
        int level,
        String escalatedTo,
        String reason,
        LocalDateTime escalatedAt
) {
}
