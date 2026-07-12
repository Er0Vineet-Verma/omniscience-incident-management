package com.ims.incident.dto;

import com.ims.common.enums.IncidentStatus;

import jakarta.validation.constraints.NotNull;

public record StatusRequest(
        @NotNull(message = "status is required") IncidentStatus status,
        String notes
) {
}
