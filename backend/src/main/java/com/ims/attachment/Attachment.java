package com.ims.attachment;

import java.time.LocalDateTime;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A file attached to a request, optionally tied to a specific conversation comment.
 * Bytes are stored in the DB (single-instance dev deployment); swap for object storage
 * (S3/GCS) if scaled. Files are validated by size + MIME before storage.
 */
@Entity
@Table(name = "attachments")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Attachment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long incidentId;

    /** Null = attached to the request itself; set = attached to a conversation comment. */
    private Long commentId;

    private String filename;

    private String contentType;

    private long sizeBytes;

    @Lob
    private byte[] data;

    private String uploadedBy;

    private LocalDateTime createdAt;
}
