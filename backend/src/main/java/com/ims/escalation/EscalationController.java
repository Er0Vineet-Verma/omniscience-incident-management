package com.ims.escalation;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ims.escalation.dto.EscalationResponse;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/escalations")
@RequiredArgsConstructor
public class EscalationController {

    private final EscalationService escalationService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ANALYST', 'ADMIN')")
    public ResponseEntity<List<EscalationResponse>> getAllEscalations() {
        return ResponseEntity.ok(escalationService.getAllEscalations());
    }

    @GetMapping("/incident/{incidentId}")
    @PreAuthorize("hasAnyRole('ANALYST', 'ADMIN')")
    public ResponseEntity<List<EscalationResponse>> getEscalationsByIncident(@PathVariable Long incidentId) {
        return ResponseEntity.ok(escalationService.getEscalationsByIncident(incidentId));
    }
}
