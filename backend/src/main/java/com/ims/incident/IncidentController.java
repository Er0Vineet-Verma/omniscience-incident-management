package com.ims.incident;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.ims.common.enums.IncidentStatus;
import com.ims.common.enums.Priority;
import com.ims.incident.dto.AssignRequest;
import com.ims.incident.dto.CloseRequest;
import com.ims.incident.dto.CommentRequest;
import com.ims.incident.dto.CommentResponse;
import com.ims.incident.dto.IncidentRequest;
import com.ims.incident.dto.IncidentResponse;
import com.ims.incident.dto.IncidentUpdateRequest;
import com.ims.incident.dto.MySummary;
import com.ims.incident.dto.StatusRequest;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/incidents")
@RequiredArgsConstructor
public class IncidentController {

    private final IncidentService incidentService;

    @PostMapping
    public ResponseEntity<IncidentResponse> create(@Valid @RequestBody IncidentRequest request,
                                                   Authentication authentication) {
        IncidentResponse response = incidentService.create(request, authentication.getName());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<Page<IncidentResponse>> list(
            @RequestParam(required = false) Priority priority,
            @RequestParam(required = false) IncidentStatus status,
            @RequestParam(required = false) Long assignedToId,
            @RequestParam(required = false) String q,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable,
            Authentication authentication) {
        Page<IncidentResponse> page = incidentService.list(priority, status, assignedToId, q,
                pageable, authentication.getName());
        return ResponseEntity.ok(page);
    }

    @GetMapping("/search")
    public ResponseEntity<List<IncidentResponse>> search(@RequestParam String q,
                                                         Authentication authentication) {
        return ResponseEntity.ok(incidentService.search(q, authentication.getName()));
    }

    /** Customer-scoped request counts for the Customer Home portal. */
    @GetMapping("/my-summary")
    public ResponseEntity<MySummary> mySummary(Authentication authentication) {
        return ResponseEntity.ok(incidentService.mySummary(authentication.getName()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<IncidentResponse> getById(@PathVariable Long id,
                                                    Authentication authentication) {
        return ResponseEntity.ok(incidentService.getById(id, authentication.getName()));
    }

    @GetMapping("/{id}/comments")
    public ResponseEntity<List<CommentResponse>> listComments(@PathVariable Long id,
                                                              Authentication authentication) {
        return ResponseEntity.ok(incidentService.listComments(id, authentication.getName()));
    }

    @PostMapping("/{id}/comments")
    public ResponseEntity<CommentResponse> addComment(@PathVariable Long id,
                                                      @Valid @RequestBody CommentRequest request,
                                                      Authentication authentication) {
        CommentResponse response = incidentService.addComment(id, request.body(), authentication.getName());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/number/{incidentNumber}")
    public ResponseEntity<IncidentResponse> getByNumber(@PathVariable String incidentNumber,
                                                        Authentication authentication) {
        return ResponseEntity.ok(incidentService.getByNumber(incidentNumber, authentication.getName()));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ANALYST', 'ADMIN')")
    public ResponseEntity<IncidentResponse> update(@PathVariable Long id,
                                                   @RequestBody IncidentUpdateRequest request,
                                                   Authentication authentication) {
        return ResponseEntity.ok(incidentService.update(id, request, authentication.getName()));
    }

    @PatchMapping("/{id}/close")
    @PreAuthorize("hasAnyRole('ANALYST', 'ADMIN')")
    public ResponseEntity<IncidentResponse> close(@PathVariable Long id,
                                                  @RequestBody(required = false) CloseRequest request,
                                                  Authentication authentication) {
        String notes = request != null ? request.notes() : null;
        return ResponseEntity.ok(incidentService.close(id, notes, authentication.getName()));
    }

    /** Customer reopens their own resolved request (ownership enforced in the service). */
    @PatchMapping("/{id}/reopen")
    public ResponseEntity<IncidentResponse> reopen(@PathVariable Long id, Authentication authentication) {
        return ResponseEntity.ok(incidentService.reopen(id, authentication.getName()));
    }

    /** Customer confirms the resolution and closes their own request. */
    @PatchMapping("/{id}/confirm-close")
    public ResponseEntity<IncidentResponse> confirmClose(@PathVariable Long id, Authentication authentication) {
        return ResponseEntity.ok(incidentService.confirmClose(id, authentication.getName()));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('ANALYST', 'ADMIN')")
    public ResponseEntity<IncidentResponse> changeStatus(@PathVariable Long id,
                                                         @Valid @RequestBody StatusRequest request,
                                                         Authentication authentication) {
        return ResponseEntity.ok(incidentService.changeStatus(id, request.status(), request.notes(),
                authentication.getName()));
    }

    @PatchMapping("/{id}/assign")
    @PreAuthorize("hasAnyRole('ANALYST', 'ADMIN')")
    public ResponseEntity<IncidentResponse> assign(@PathVariable Long id,
                                                   @Valid @RequestBody AssignRequest request,
                                                   Authentication authentication) {
        return ResponseEntity.ok(incidentService.assign(id, request.analystId(), authentication.getName()));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long id, Authentication authentication) {
        incidentService.delete(id, authentication.getName());
        return ResponseEntity.noContent().build();
    }
}
