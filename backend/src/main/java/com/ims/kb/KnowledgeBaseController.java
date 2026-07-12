package com.ims.kb;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.ims.kb.dto.KbRequest;
import com.ims.kb.dto.KbResponse;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/kb")
@RequiredArgsConstructor
public class KnowledgeBaseController {

    private final KnowledgeBaseService knowledgeBaseService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ANALYST', 'ADMIN')") // full catalog incl. INTERNAL — customers use /help
    public ResponseEntity<List<KbResponse>> list() {
        return ResponseEntity.ok(knowledgeBaseService.list());
    }

    /** Customer Help Center feed — only customer-facing articles (CUSTOMER + BOTH). */
    @GetMapping("/help")
    public ResponseEntity<List<KbResponse>> help() {
        return ResponseEntity.ok(knowledgeBaseService.listForCustomer());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ANALYST', 'ADMIN')") // may be INTERNAL — customers use /help payload
    public ResponseEntity<KbResponse> get(@PathVariable Long id) {
        return ResponseEntity.ok(knowledgeBaseService.get(id));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ANALYST', 'ADMIN')")
    public ResponseEntity<KbResponse> create(@Valid @RequestBody KbRequest request, Authentication authentication) {
        KbResponse response = knowledgeBaseService.create(request, authentication.getName());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ANALYST', 'ADMIN')")
    public ResponseEntity<KbResponse> update(@PathVariable Long id,
                                             @Valid @RequestBody KbRequest request,
                                             Authentication authentication) {
        return ResponseEntity.ok(knowledgeBaseService.update(id, request, authentication.getName()));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long id, Authentication authentication) {
        knowledgeBaseService.delete(id, authentication.getName());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/match")
    @PreAuthorize("hasAnyRole('ANALYST', 'ADMIN')") // RCA suggestion helper — internal only
    public ResponseEntity<List<KbResponse>> match(@RequestParam String text) {
        return ResponseEntity.ok(knowledgeBaseService.match(text));
    }
}
