package com.ims.incident.dto;

/**
 * Optional body for PATCH /api/incidents/{id}/close.
 */
public record CloseRequest(
        String notes
) {
}
