package com.ims.sla.dto;

import com.ims.common.enums.Priority;

public record SlaRuleResponse(
        Long id,
        Priority priority,
        int resolutionTimeHours
) {
}
