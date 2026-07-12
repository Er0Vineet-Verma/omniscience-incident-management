package com.ims.incident.dto;

import java.time.LocalDateTime;

import com.ims.incident.IncidentComment;

public record CommentResponse(
        Long id,
        Long incidentId,
        String authorName,
        String authorEmail,
        String body,
        LocalDateTime createdAt
) {
    public static CommentResponse from(IncidentComment comment) {
        return new CommentResponse(
                comment.getId(),
                comment.getIncident().getId(),
                comment.getAuthorName(),
                comment.getAuthorEmail(),
                comment.getBody(),
                comment.getCreatedAt()
        );
    }
}
