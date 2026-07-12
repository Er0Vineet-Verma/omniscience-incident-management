package com.ims.incident.dto;

import jakarta.validation.constraints.NotNull;

public record AssignRequest(
        @NotNull(message = "analystId is required") Long analystId
) {
}
