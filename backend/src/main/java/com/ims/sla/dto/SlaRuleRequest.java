package com.ims.sla.dto;

import jakarta.validation.constraints.Min;

public record SlaRuleRequest(
        @Min(value = 1, message = "resolutionTimeHours must be at least 1")
        int resolutionTimeHours
) {
}
