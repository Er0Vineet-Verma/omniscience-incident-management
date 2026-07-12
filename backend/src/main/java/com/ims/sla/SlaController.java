package com.ims.sla;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ims.sla.dto.SlaRuleRequest;
import com.ims.sla.dto.SlaRuleResponse;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/sla")
@RequiredArgsConstructor
public class SlaController {

    private final SlaService slaService;

    @GetMapping("/rules")
    public ResponseEntity<List<SlaRuleResponse>> getRules() {
        return ResponseEntity.ok(slaService.listRules());
    }

    @PutMapping("/rules/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<SlaRuleResponse> updateRule(@PathVariable Long id,
                                                      @Valid @RequestBody SlaRuleRequest request,
                                                      Authentication authentication) {
        return ResponseEntity.ok(slaService.updateRule(id, request, authentication.getName()));
    }
}
