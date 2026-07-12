package com.ims.audit;

import java.time.LocalDate;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.ims.audit.dto.AuditResponse;
import com.ims.audit.dto.AuditStats;
import com.ims.common.enums.AuditAction;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/audit")
@RequiredArgsConstructor
public class AuditController {

    private final AuditLogRepository auditLogRepository;

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Page<AuditResponse>> getAuditTrail(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<AuditResponse> result = auditLogRepository
                .findAllByOrderByTimestampDesc(PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 100)))
                .map(AuditResponse::from);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/stats")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<AuditStats> stats() {
        return ResponseEntity.ok(new AuditStats(
                auditLogRepository.count(),
                auditLogRepository.countByTimestampAfter(LocalDate.now().atStartOfDay()),
                auditLogRepository.countByAction(AuditAction.ESCALATED),
                auditLogRepository.countByAction(AuditAction.RESOLVED),
                auditLogRepository.countByAction(AuditAction.DELETED),
                auditLogRepository.countDistinctActors()));
    }

    @GetMapping("/incident/{incidentId}")
    @PreAuthorize("hasAnyRole('ANALYST', 'ADMIN')")
    public ResponseEntity<List<AuditResponse>> getIncidentAuditTrail(@PathVariable Long incidentId) {
        List<AuditResponse> result = auditLogRepository
                .findByEntityTypeAndEntityIdOrderByTimestampDesc("INCIDENT", incidentId)
                .stream()
                .map(AuditResponse::from)
                .toList();
        return ResponseEntity.ok(result);
    }
}
