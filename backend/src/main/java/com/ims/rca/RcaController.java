package com.ims.rca;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ims.rca.dto.RcaAnalyzeRequest;
import com.ims.rca.dto.RcaResult;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/rca")
@RequiredArgsConstructor
public class RcaController {

    private final RcaService rcaService;

    @GetMapping("/incident/{id}")
    @PreAuthorize("hasAnyRole('ANALYST', 'ADMIN')")
    public ResponseEntity<RcaResult> analyzeIncident(@PathVariable Long id) {
        return ResponseEntity.ok(rcaService.analyzeIncident(id));
    }

    @PostMapping("/analyze")
    @PreAuthorize("hasAnyRole('ANALYST', 'ADMIN')")
    public ResponseEntity<RcaResult> analyzeLogs(@Valid @RequestBody RcaAnalyzeRequest request) {
        return ResponseEntity.ok(rcaService.analyzeLogs(request.logs()));
    }
}
