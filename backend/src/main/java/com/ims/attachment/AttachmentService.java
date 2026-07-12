package com.ims.attachment;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.ims.attachment.dto.AttachmentResponse;
import com.ims.audit.AuditService;
import com.ims.common.enums.AuditAction;
import com.ims.common.exception.BadRequestException;
import com.ims.common.exception.NotFoundException;
import com.ims.incident.IncidentAccessGuard;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class AttachmentService {

    private static final long MAX_BYTES = 12L * 1024 * 1024; // 12MB (matches multipart limit)
    private static final Set<String> ALLOWED_TYPES = Set.of(
            "image/png", "image/jpeg", "image/gif", "image/webp",
            "application/pdf", "text/plain", "application/zip");

    private final AttachmentRepository attachmentRepository;
    private final IncidentAccessGuard accessGuard;
    private final AuditService auditService;

    @Transactional
    public AttachmentResponse upload(Long incidentId, Long commentId, MultipartFile file, String email) {
        accessGuard.requireVisible(incidentId, email);
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Uploaded file is empty");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new BadRequestException("File exceeds the 12MB limit");
        }
        String contentType = file.getContentType() != null
                ? file.getContentType().toLowerCase(Locale.ROOT).split(";")[0].trim()
                : "application/octet-stream";
        if (!ALLOWED_TYPES.contains(contentType)) {
            throw new BadRequestException("Unsupported file type: " + contentType
                    + " (allowed: images, PDF, text, zip)");
        }
        byte[] data;
        try {
            data = file.getBytes();
        } catch (IOException ex) {
            throw new BadRequestException("Failed to read uploaded file: " + ex.getMessage());
        }
        Attachment attachment = attachmentRepository.save(Attachment.builder()
                .incidentId(incidentId)
                .commentId(commentId)
                .filename(file.getOriginalFilename())
                .contentType(contentType)
                .sizeBytes(file.getSize())
                .data(data)
                .uploadedBy(email)
                .createdAt(LocalDateTime.now())
                .build());
        auditService.record("INCIDENT", incidentId, AuditAction.UPDATED, "attachment",
                null, attachment.getFilename(), email);
        return AttachmentResponse.from(attachment);
    }

    @Transactional(readOnly = true)
    public List<AttachmentResponse> list(Long incidentId, String email) {
        accessGuard.requireVisible(incidentId, email);
        return attachmentRepository.findByIncidentIdOrderByCreatedAtAsc(incidentId).stream()
                .map(AttachmentResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public Attachment download(Long incidentId, Long attachmentId, String email) {
        accessGuard.requireVisible(incidentId, email);
        Attachment attachment = attachmentRepository.findById(attachmentId)
                .orElseThrow(() -> new NotFoundException("Attachment not found with id: " + attachmentId));
        if (!attachment.getIncidentId().equals(incidentId)) {
            throw new NotFoundException("Attachment does not belong to this request");
        }
        return attachment;
    }
}
