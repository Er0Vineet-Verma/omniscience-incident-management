package com.ims.csat;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ims.audit.AuditService;
import com.ims.common.enums.AuditAction;
import com.ims.common.enums.IncidentStatus;
import com.ims.common.exception.BadRequestException;
import com.ims.csat.dto.CsatRequest;
import com.ims.csat.dto.CsatResponse;
import com.ims.csat.dto.CsatSummaryRow;
import com.ims.incident.Incident;
import com.ims.incident.IncidentAccessGuard;
import com.ims.user.User;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class CsatService {

    private final CsatRepository csatRepository;
    private final IncidentAccessGuard accessGuard;
    private final AuditService auditService;

    /** Submit (or update) the satisfaction rating for a resolved/closed request. */
    @Transactional
    public CsatResponse submit(Long incidentId, CsatRequest request, String email) {
        Incident incident = accessGuard.requireVisible(incidentId, email);
        if (incident.getStatus() != IncidentStatus.RESOLVED && incident.getStatus() != IncidentStatus.CLOSED) {
            throw new BadRequestException("You can rate a request only after it is resolved");
        }
        CsatRating rating = csatRepository.findByIncidentId(incidentId).orElseGet(CsatRating::new);
        rating.setIncidentId(incidentId);
        User analyst = incident.getAssignedTo();
        rating.setAnalystId(analyst != null ? analyst.getId() : null);
        rating.setAnalystName(analyst != null ? analyst.getName() : null);
        rating.setRating(request.rating());
        rating.setComment(request.comment());
        rating.setSubmittedBy(email);
        if (rating.getCreatedAt() == null) {
            rating.setCreatedAt(LocalDateTime.now());
        }
        CsatRating saved = csatRepository.save(rating);
        auditService.record("INCIDENT", incidentId, AuditAction.UPDATED, "csat",
                null, String.valueOf(request.rating()), email);
        return CsatResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public Optional<CsatResponse> get(Long incidentId, String email) {
        accessGuard.requireVisible(incidentId, email);
        return csatRepository.findByIncidentId(incidentId).map(CsatResponse::from);
    }

    /** Per-analyst CSAT aggregate (average + count) for reporting. */
    @Transactional(readOnly = true)
    public List<CsatSummaryRow> summaryByAnalyst() {
        Map<Long, List<CsatRating>> byAnalyst = csatRepository.findAll().stream()
                .filter(r -> r.getAnalystId() != null)
                .collect(Collectors.groupingBy(CsatRating::getAnalystId));
        return byAnalyst.entrySet().stream()
                .map(entry -> {
                    List<CsatRating> ratings = entry.getValue();
                    double avg = ratings.stream().mapToInt(CsatRating::getRating).average().orElse(0);
                    return new CsatSummaryRow(entry.getKey(), ratings.get(0).getAnalystName(),
                            ratings.size(), Math.round(avg * 10.0) / 10.0);
                })
                .toList();
    }
}
