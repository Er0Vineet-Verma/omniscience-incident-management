package com.ims.incident.dto;

import com.ims.common.enums.IncidentStatus;
import com.ims.common.enums.Priority;

/**
 * Partial update payload — every field is optional; only non-null fields are applied.
 */
public record IncidentUpdateRequest(
        String title,
        String description,
        Priority priority,
        IncidentStatus status,
        String resolutionNotes,
        String rootCause
) {
}
