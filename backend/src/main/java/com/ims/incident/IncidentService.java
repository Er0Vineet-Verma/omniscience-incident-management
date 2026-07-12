package com.ims.incident;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ims.assignment.AssignmentService;
import com.ims.audit.AuditService;
import com.ims.common.enums.AuditAction;
import com.ims.common.enums.IncidentStatus;
import com.ims.common.enums.Priority;
import com.ims.common.enums.Role;
import com.ims.common.exception.BadRequestException;
import com.ims.common.exception.NotFoundException;
import com.ims.incident.dto.CommentResponse;
import com.ims.incident.dto.IncidentRequest;
import com.ims.incident.dto.IncidentResponse;
import com.ims.incident.dto.IncidentUpdateRequest;
import com.ims.incident.dto.MySummary;
import com.ims.sla.SlaRule;
import com.ims.sla.SlaRuleRepository;
import com.ims.user.User;
import com.ims.user.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class IncidentService {

    private static final String ENTITY_TYPE = "INCIDENT";
    private static final int DEFAULT_RESOLUTION_HOURS = 24;
    private static final int AUDIT_VALUE_MAX_LENGTH = 1000;

    private final IncidentRepository incidentRepository;
    private final IncidentCommentRepository commentRepository;
    private final UserRepository userRepository;
    private final SlaRuleRepository slaRuleRepository;
    private final AssignmentService assignmentService;
    private final AuditService auditService;

    @Transactional
    public IncidentResponse create(IncidentRequest request, String creatorEmail) {
        User creator = requireUser(creatorEmail);
        LocalDateTime now = LocalDateTime.now();

        int resolutionHours = slaRuleRepository.findByPriority(request.priority())
                .map(SlaRule::getResolutionTimeHours)
                .orElse(DEFAULT_RESOLUTION_HOURS);

        Incident incident = Incident.builder()
                .title(request.title())
                .description(request.description())
                .priority(request.priority())
                .status(IncidentStatus.OPEN)
                .createdAt(now)
                .updatedAt(now)
                .slaDeadline(now.plusHours(resolutionHours))
                .createdBy(creator)
                .build();

        Optional<User> analyst = assignmentService.nextAnalyst();
        analyst.ifPresent(incident::setAssignedTo);

        Incident saved = incidentRepository.save(incident);
        saved.setIncidentNumber("INC-" + String.format("%05d", 1000 + saved.getId()));
        saved = incidentRepository.save(saved);

        auditService.record(ENTITY_TYPE, saved.getId(), AuditAction.CREATED, null,
                null, saved.getIncidentNumber(), creatorEmail);
        if (analyst.isPresent()) {
            auditService.record(ENTITY_TYPE, saved.getId(), AuditAction.ASSIGNED, "assignedTo",
                    null, analyst.get().getEmail(), creatorEmail);
        }
        return IncidentResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public IncidentResponse getById(Long id, String requesterEmail) {
        Incident incident = requireIncident(id);
        enforceVisibility(incident, requesterEmail);
        return IncidentResponse.from(incident);
    }

    @Transactional(readOnly = true)
    public IncidentResponse getByNumber(String incidentNumber, String requesterEmail) {
        Incident incident = incidentRepository.findByIncidentNumber(incidentNumber)
                .orElseThrow(() -> new NotFoundException("Incident not found with number: " + incidentNumber));
        enforceVisibility(incident, requesterEmail);
        return IncidentResponse.from(incident);
    }

    @Transactional(readOnly = true)
    public Page<IncidentResponse> list(Priority priority, IncidentStatus status, Long assignedToId,
                                       String q, Pageable pageable, String requesterEmail) {
        List<Specification<Incident>> specs = new ArrayList<>();
        if (priority != null) {
            specs.add(IncidentSpecifications.hasPriority(priority));
        }
        if (status != null) {
            specs.add(IncidentSpecifications.hasStatus(status));
        }
        if (assignedToId != null) {
            specs.add(IncidentSpecifications.assignedToId(assignedToId));
        }
        if (q != null && !q.isBlank()) {
            specs.add(IncidentSpecifications.matchesQuery(q));
        }
        if (isCustomer(requesterEmail)) {
            specs.add(IncidentSpecifications.createdByEmail(requesterEmail));
        }
        return incidentRepository.findAll(Specification.allOf(specs), pageable)
                .map(IncidentResponse::from);
    }

    @Transactional(readOnly = true)
    public List<IncidentResponse> search(String q, String requesterEmail) {
        List<Specification<Incident>> specs = new ArrayList<>();
        if (q != null && !q.isBlank()) {
            specs.add(IncidentSpecifications.matchesQuery(q));
        }
        if (isCustomer(requesterEmail)) {
            specs.add(IncidentSpecifications.createdByEmail(requesterEmail));
        }
        return incidentRepository.findAll(Specification.allOf(specs)).stream()
                .map(IncidentResponse::from)
                .toList();
    }

    /** Customer-scoped request counts for the Customer Home portal. */
    @Transactional(readOnly = true)
    public MySummary mySummary(String requesterEmail) {
        List<Incident> mine = incidentRepository.findAll(IncidentSpecifications.createdByEmail(requesterEmail));
        long open = 0, inProgress = 0, pending = 0, resolved = 0, closed = 0;
        for (Incident incident : mine) {
            switch (incident.getStatus()) {
                case OPEN -> open++;
                case IN_PROGRESS -> inProgress++;
                case PENDING -> pending++;
                case RESOLVED -> resolved++;
                case CLOSED -> closed++;
            }
        }
        return new MySummary(open, inProgress, pending, resolved, closed, mine.size());
    }

    /** Customer reopens their own resolved request (issue persisted). */
    @Transactional
    public IncidentResponse reopen(Long id, String actorEmail) {
        Incident incident = requireIncident(id);
        enforceVisibility(incident, actorEmail);
        if (incident.getStatus() != IncidentStatus.RESOLVED) {
            throw new BadRequestException("Only resolved requests can be reopened");
        }
        LocalDateTime now = LocalDateTime.now();
        IncidentStatus oldStatus = incident.getStatus();
        incident.setStatus(IncidentStatus.IN_PROGRESS);
        incident.setResolvedAt(null);
        incident.setUpdatedAt(now);
        Incident saved = incidentRepository.save(incident);
        auditService.record(ENTITY_TYPE, saved.getId(), AuditAction.STATUS_CHANGED, "status",
                oldStatus.name(), IncidentStatus.IN_PROGRESS.name(), actorEmail);
        return IncidentResponse.from(saved);
    }

    /** Customer confirms a resolution is good and closes their own request. */
    @Transactional
    public IncidentResponse confirmClose(Long id, String actorEmail) {
        Incident incident = requireIncident(id);
        enforceVisibility(incident, actorEmail);
        if (incident.getStatus() != IncidentStatus.RESOLVED) {
            throw new BadRequestException("Only resolved requests can be confirmed and closed");
        }
        LocalDateTime now = LocalDateTime.now();
        IncidentStatus oldStatus = incident.getStatus();
        incident.setStatus(IncidentStatus.CLOSED);
        incident.setClosedAt(now);
        incident.setUpdatedAt(now);
        Incident saved = incidentRepository.save(incident);
        auditService.record(ENTITY_TYPE, saved.getId(), AuditAction.CLOSED, "status",
                oldStatus.name(), IncidentStatus.CLOSED.name(), actorEmail);
        return IncidentResponse.from(saved);
    }

    @Transactional
    public IncidentResponse update(Long id, IncidentUpdateRequest request, String actorEmail) {
        Incident incident = requireIncident(id);
        LocalDateTime now = LocalDateTime.now();

        if (request.title() != null && !request.title().isBlank()
                && !request.title().equals(incident.getTitle())) {
            auditService.record(ENTITY_TYPE, incident.getId(), AuditAction.UPDATED, "title",
                    truncate(incident.getTitle()), truncate(request.title()), actorEmail);
            incident.setTitle(request.title());
        }
        if (request.description() != null && !Objects.equals(request.description(), incident.getDescription())) {
            auditService.record(ENTITY_TYPE, incident.getId(), AuditAction.UPDATED, "description",
                    truncate(incident.getDescription()), truncate(request.description()), actorEmail);
            incident.setDescription(request.description());
        }
        if (request.priority() != null && request.priority() != incident.getPriority()) {
            auditService.record(ENTITY_TYPE, incident.getId(), AuditAction.PRIORITY_CHANGED, "priority",
                    enumName(incident.getPriority()), request.priority().name(), actorEmail);
            incident.setPriority(request.priority());
        }
        if (request.status() != null && request.status() != incident.getStatus()) {
            applyStatusChange(incident, request.status(), now, actorEmail);
        }
        if (request.resolutionNotes() != null
                && !Objects.equals(request.resolutionNotes(), incident.getResolutionNotes())) {
            auditService.record(ENTITY_TYPE, incident.getId(), AuditAction.UPDATED, "resolutionNotes",
                    truncate(incident.getResolutionNotes()), truncate(request.resolutionNotes()), actorEmail);
            incident.setResolutionNotes(request.resolutionNotes());
        }
        if (request.rootCause() != null && !Objects.equals(request.rootCause(), incident.getRootCause())) {
            auditService.record(ENTITY_TYPE, incident.getId(), AuditAction.UPDATED, "rootCause",
                    truncate(incident.getRootCause()), truncate(request.rootCause()), actorEmail);
            incident.setRootCause(request.rootCause());
        }

        incident.setUpdatedAt(now);
        return IncidentResponse.from(incidentRepository.save(incident));
    }

    @Transactional
    public IncidentResponse close(Long id, String notes, String actorEmail) {
        Incident incident = requireIncident(id);
        if (incident.getStatus() == IncidentStatus.CLOSED) {
            throw new BadRequestException("Incident " + incident.getIncidentNumber() + " is already closed");
        }
        LocalDateTime now = LocalDateTime.now();
        IncidentStatus oldStatus = incident.getStatus();
        incident.setStatus(IncidentStatus.CLOSED);
        incident.setClosedAt(now);
        incident.setUpdatedAt(now);
        if (notes != null && !notes.isBlank()) {
            incident.setResolutionNotes(notes);
        }
        Incident saved = incidentRepository.save(incident);
        auditService.record(ENTITY_TYPE, saved.getId(), AuditAction.CLOSED, "status",
                oldStatus.name(), IncidentStatus.CLOSED.name(), actorEmail);
        return IncidentResponse.from(saved);
    }

    @Transactional
    public IncidentResponse changeStatus(Long id, IncidentStatus newStatus, String notes, String actorEmail) {
        Incident incident = requireIncident(id);
        LocalDateTime now = LocalDateTime.now();
        if (newStatus != incident.getStatus()) {
            applyStatusChange(incident, newStatus, now, actorEmail);
        }
        if (notes != null && !notes.isBlank()) {
            incident.setResolutionNotes(notes);
        }
        incident.setUpdatedAt(now);
        return IncidentResponse.from(incidentRepository.save(incident));
    }

    @Transactional
    public IncidentResponse assign(Long id, Long analystId, String actorEmail) {
        Incident incident = requireIncident(id);
        User analyst = userRepository.findById(analystId)
                .orElseThrow(() -> new NotFoundException("User not found with id: " + analystId));
        if (analyst.getRole() != Role.ANALYST) {
            throw new BadRequestException("User " + analyst.getEmail() + " is not an analyst");
        }
        String oldAssignee = incident.getAssignedTo() != null ? incident.getAssignedTo().getEmail() : null;
        incident.setAssignedTo(analyst);
        incident.setUpdatedAt(LocalDateTime.now());
        Incident saved = incidentRepository.save(incident);
        auditService.record(ENTITY_TYPE, saved.getId(), AuditAction.ASSIGNED, "assignedTo",
                oldAssignee, analyst.getEmail(), actorEmail);
        return IncidentResponse.from(saved);
    }

    @Transactional
    public void delete(Long id, String actorEmail) {
        Incident incident = requireIncident(id);
        String incidentNumber = incident.getIncidentNumber();
        incidentRepository.delete(incident);
        auditService.record(ENTITY_TYPE, id, AuditAction.DELETED, null,
                incidentNumber, null, actorEmail);
    }

    @Transactional(readOnly = true)
    public List<CommentResponse> listComments(Long incidentId, String requesterEmail) {
        Incident incident = requireIncident(incidentId);
        enforceVisibility(incident, requesterEmail);
        return commentRepository.findByIncidentIdOrderByCreatedAtAsc(incident.getId()).stream()
                .map(CommentResponse::from)
                .toList();
    }

    @Transactional
    public CommentResponse addComment(Long incidentId, String body, String actorEmail) {
        Incident incident = requireIncident(incidentId);
        enforceVisibility(incident, actorEmail);
        User author = requireUser(actorEmail);
        IncidentComment comment = commentRepository.save(IncidentComment.builder()
                .incident(incident)
                .authorEmail(author.getEmail())
                .authorName(author.getName())
                .body(body)
                .createdAt(LocalDateTime.now())
                .build());
        auditService.record(ENTITY_TYPE, incident.getId(), AuditAction.UPDATED, "comment",
                null, truncate(body), actorEmail);
        return CommentResponse.from(comment);
    }

    private void applyStatusChange(Incident incident, IncidentStatus newStatus,
                                   LocalDateTime now, String actorEmail) {
        IncidentStatus oldStatus = incident.getStatus();
        incident.setStatus(newStatus);
        if (newStatus == IncidentStatus.RESOLVED) {
            incident.setResolvedAt(now);
        }
        if (newStatus == IncidentStatus.CLOSED) {
            incident.setClosedAt(now);
        }
        AuditAction action = switch (newStatus) {
            case RESOLVED -> AuditAction.RESOLVED;
            case CLOSED -> AuditAction.CLOSED;
            default -> AuditAction.STATUS_CHANGED;
        };
        auditService.record(ENTITY_TYPE, incident.getId(), action, "status",
                enumName(oldStatus), newStatus.name(), actorEmail);
    }

    private void enforceVisibility(Incident incident, String requesterEmail) {
        if (!isCustomer(requesterEmail)) {
            return;
        }
        User createdBy = incident.getCreatedBy();
        if (createdBy == null || !requesterEmail.equalsIgnoreCase(createdBy.getEmail())) {
            throw new AccessDeniedException("Customers may only view their own incidents");
        }
    }

    private boolean isCustomer(String email) {
        return requireUser(email).getRole() == Role.CUSTOMER;
    }

    private Incident requireIncident(Long id) {
        return incidentRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Incident not found with id: " + id));
    }

    private User requireUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new NotFoundException("User not found: " + email));
    }

    private static String enumName(Enum<?> value) {
        return value != null ? value.name() : null;
    }

    /** Audit old/new value columns are limited to 1000 chars. */
    private static String truncate(String value) {
        if (value == null || value.length() <= AUDIT_VALUE_MAX_LENGTH) {
            return value;
        }
        return value.substring(0, AUDIT_VALUE_MAX_LENGTH);
    }
}
