package com.ims.attachment;

import java.util.List;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.ims.attachment.dto.AttachmentResponse;

import lombok.RequiredArgsConstructor;

/**
 * Attachments for a request. Any authenticated user may call; the service enforces that
 * customers only touch their own requests (via IncidentAccessGuard).
 */
@RestController
@RequestMapping("/api/incidents/{incidentId}/attachments")
@RequiredArgsConstructor
public class AttachmentController {

    private final AttachmentService attachmentService;

    @PostMapping
    public ResponseEntity<AttachmentResponse> upload(@PathVariable Long incidentId,
                                                     @RequestParam("file") MultipartFile file,
                                                     @RequestParam(value = "commentId", required = false) Long commentId,
                                                     Authentication authentication) {
        AttachmentResponse response = attachmentService.upload(incidentId, commentId, file, authentication.getName());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<List<AttachmentResponse>> list(@PathVariable Long incidentId,
                                                         Authentication authentication) {
        return ResponseEntity.ok(attachmentService.list(incidentId, authentication.getName()));
    }

    @GetMapping("/{attachmentId}/download")
    public ResponseEntity<byte[]> download(@PathVariable Long incidentId,
                                           @PathVariable Long attachmentId,
                                           Authentication authentication) {
        Attachment attachment = attachmentService.download(incidentId, attachmentId, authentication.getName());
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(attachment.getContentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + attachment.getFilename() + "\"")
                .body(attachment.getData());
    }
}
