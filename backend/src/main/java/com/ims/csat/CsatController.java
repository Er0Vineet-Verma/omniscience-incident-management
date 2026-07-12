package com.ims.csat;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ims.csat.dto.CsatRequest;
import com.ims.csat.dto.CsatResponse;
import com.ims.csat.dto.CsatSummaryRow;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/csat")
@RequiredArgsConstructor
public class CsatController {

    private final CsatService csatService;

    /** Customer submits/updates the rating for their own resolved request (ownership enforced). */
    @PostMapping("/incident/{incidentId}")
    public ResponseEntity<CsatResponse> submit(@PathVariable Long incidentId,
                                               @Valid @RequestBody CsatRequest request,
                                               Authentication authentication) {
        return ResponseEntity.ok(csatService.submit(incidentId, request, authentication.getName()));
    }

    @GetMapping("/incident/{incidentId}")
    public ResponseEntity<CsatResponse> get(@PathVariable Long incidentId, Authentication authentication) {
        return csatService.get(incidentId, authentication.getName())
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @GetMapping("/summary")
    @PreAuthorize("hasAnyRole('ANALYST', 'ADMIN')")
    public ResponseEntity<List<CsatSummaryRow>> summary() {
        return ResponseEntity.ok(csatService.summaryByAnalyst());
    }
}
