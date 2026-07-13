package com.ims.logs;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.ims.audit.AuditService;
import com.ims.common.enums.AuditAction;
import com.ims.common.enums.LogLevel;
import com.ims.common.exception.BadRequestException;
import com.ims.common.exception.NotFoundException;
import com.ims.incident.Incident;
import com.ims.incident.IncidentRepository;
import com.ims.logs.dto.LogResponse;
import com.ims.logs.dto.LogUploadResult;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class LogService {

    private static final long MAX_FILE_SIZE_BYTES = 10L * 1024 * 1024; // 10MB

    // Declared MIME types we accept for .log/.txt. Browsers commonly send
    // application/octet-stream (or nothing) for .log, so those are tolerated;
    // a binary-content sniff below is the real guard against spoofed types.
    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
            "text/plain", "text/x-log", "application/log", "application/octet-stream");

    private static final int BINARY_SNIFF_BYTES = 8192;

    private final LogEntryRepository logEntryRepository;
    private final IncidentRepository incidentRepository;
    private final LogParserService logParserService;
    private final AuditService auditService;

    @Transactional
    public LogUploadResult upload(MultipartFile file, Long incidentId, String uploaderEmail) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Uploaded file is empty");
        }
        String filename = file.getOriginalFilename();
        String lowerName = filename == null ? "" : filename.toLowerCase(Locale.ROOT);
        if (!lowerName.endsWith(".log") && !lowerName.endsWith(".txt")) {
            throw new BadRequestException("Only .log and .txt files are supported");
        }
        if (file.getSize() > MAX_FILE_SIZE_BYTES) {
            throw new BadRequestException("File size exceeds the 10MB limit");
        }
        String contentType = file.getContentType();
        if (contentType != null && !contentType.isBlank()) {
            String normalized = contentType.toLowerCase(Locale.ROOT).split(";")[0].trim();
            if (!ALLOWED_CONTENT_TYPES.contains(normalized)) {
                throw new BadRequestException("Unsupported content type: " + normalized
                        + " (expected a plain-text log)");
            }
        }

        Incident incident = null;
        if (incidentId != null) {
            incident = incidentRepository.findById(incidentId)
                    .orElseThrow(() -> new NotFoundException("Incident not found with id: " + incidentId));
        }

        byte[] content;
        try {
            content = file.getBytes();
        } catch (IOException ex) {
            throw new BadRequestException("Failed to read uploaded file: " + ex.getMessage());
        }
        if (looksBinary(content)) {
            throw new BadRequestException("Uploaded file appears to be binary; only plain-text logs are supported");
        }

        List<String> lines;
        try (InputStream inputStream = new ByteArrayInputStream(content)) {
            lines = logParserService.readLines(inputStream);
        } catch (IOException ex) {
            throw new BadRequestException("Failed to read uploaded file: " + ex.getMessage());
        }

        List<LogEntry> entries = logParserService.parse(lines);

        LocalDateTime now = LocalDateTime.now();
        for (LogEntry entry : entries) {
            entry.setIncident(incident);
            entry.setSource(filename);
            entry.setUploadedBy(uploaderEmail);
            entry.setCreatedAt(now);
        }
        logEntryRepository.saveAll(entries);

        int errors = 0;
        int warnings = 0;
        int infos = 0;
        for (LogEntry entry : entries) {
            LogLevel level = entry.getLogLevel();
            if (level == LogLevel.ERROR || level == LogLevel.FATAL) {
                errors++;
            } else if (level == LogLevel.WARN) {
                warnings++;
            } else if (level == LogLevel.INFO) {
                infos++;
            }
        }

        String auditDetail = "Uploaded " + entries.size() + " log entries from " + filename;
        if (incident != null) {
            auditService.record("INCIDENT", incident.getId(), AuditAction.LOG_UPLOADED,
                    "logs", null, auditDetail, uploaderEmail);
        } else {
            auditService.record("LOG", null, AuditAction.LOG_UPLOADED,
                    "logs", null, auditDetail, uploaderEmail);
        }

        return new LogUploadResult(filename, lines.size(), entries.size(), errors, warnings, infos, incidentId);
    }

    /** A NUL byte in the first few KB is a strong signal the upload is binary, not a text log. */
    private boolean looksBinary(byte[] content) {
        int limit = Math.min(content.length, BINARY_SNIFF_BYTES);
        for (int i = 0; i < limit; i++) {
            if (content[i] == 0) {
                return true;
            }
        }
        return false;
    }

    @Transactional(readOnly = true)
    public Page<LogResponse> search(LogLevel level, Long incidentId, String q,
                                    LocalDateTime from, LocalDateTime to, Pageable pageable) {
        List<Specification<LogEntry>> specs = new ArrayList<>();
        if (level != null) {
            specs.add((root, query, cb) -> cb.equal(root.get("logLevel"), level));
        }
        if (incidentId != null) {
            specs.add((root, query, cb) -> cb.equal(root.get("incident").get("id"), incidentId));
        }
        if (q != null && !q.isBlank()) {
            String like = "%" + q.toLowerCase(Locale.ROOT) + "%";
            specs.add((root, query, cb) -> cb.like(cb.lower(root.get("message")), like));
        }
        if (from != null) {
            specs.add((root, query, cb) -> cb.greaterThanOrEqualTo(root.get("timestamp"), from));
        }
        if (to != null) {
            specs.add((root, query, cb) -> cb.lessThanOrEqualTo(root.get("timestamp"), to));
        }
        return logEntryRepository.findAll(Specification.allOf(specs), pageable)
                .map(LogResponse::from);
    }

    @Transactional(readOnly = true)
    public List<LogResponse> findByIncident(Long incidentId) {
        if (!incidentRepository.existsById(incidentId)) {
            throw new NotFoundException("Incident not found with id: " + incidentId);
        }
        return logEntryRepository.findByIncidentId(incidentId).stream()
                .map(LogResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public Map<String, Long> stats() {
        Map<String, Long> stats = new LinkedHashMap<>();
        long total = 0;
        for (LogLevel level : LogLevel.values()) {
            long count = logEntryRepository.countByLogLevel(level);
            stats.put(level.name(), count);
            total += count;
        }
        stats.put("TOTAL", total);
        return stats;
    }
}
