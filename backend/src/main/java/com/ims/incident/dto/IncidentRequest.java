package com.ims.incident.dto;

import com.ims.common.enums.Priority;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record IncidentRequest(
        @NotBlank(message = "title is required") String title,
        String description,
        @NotNull(message = "priority is required") Priority priority
) {
}
