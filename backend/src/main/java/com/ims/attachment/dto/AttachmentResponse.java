package com.ims.attachment.dto;

import java.time.LocalDateTime;

import com.ims.attachment.Attachment;

/** Attachment metadata (never includes the file bytes). */
public record AttachmentResponse(
        Long id,
        Long incidentId,
        Long commentId,
        String filename,
        String contentType,
        long sizeBytes,
        String uploadedBy,
        LocalDateTime createdAt
) {
    public static AttachmentResponse from(Attachment a) {
        return new AttachmentResponse(a.getId(), a.getIncidentId(), a.getCommentId(),
                a.getFilename(), a.getContentType(), a.getSizeBytes(), a.getUploadedBy(), a.getCreatedAt());
    }
}
