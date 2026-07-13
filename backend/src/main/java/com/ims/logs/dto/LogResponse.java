package com.ims.logs.dto;

import java.time.LocalDateTime;

import com.ims.common.enums.LogLevel;
import com.ims.logs.LogEntry;

public record LogResponse(
        Long id,
        Long incidentId,
        LocalDateTime timestamp,
        LogLevel logLevel,
        String message,
        String source,
        String uploadedBy,
        LocalDateTime createdAt
) {
    public static LogResponse from(LogEntry entry) {
        return new LogResponse(
                entry.getId(),
                entry.getIncident() != null ? entry.getIncident().getId() : null,
                entry.getTimestamp(),
                entry.getLogLevel(),
                entry.getMessage(),
                entry.getSource(),
                entry.getUploadedBy(),
                entry.getCreatedAt());
    }
}
