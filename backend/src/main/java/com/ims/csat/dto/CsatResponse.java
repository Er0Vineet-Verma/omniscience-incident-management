package com.ims.csat.dto;

import java.time.LocalDateTime;

import com.ims.csat.CsatRating;

public record CsatResponse(
        Long id,
        Long incidentId,
        Long analystId,
        String analystName,
        int rating,
        String comment,
        String submittedBy,
        LocalDateTime createdAt
) {
    public static CsatResponse from(CsatRating r) {
        return new CsatResponse(r.getId(), r.getIncidentId(), r.getAnalystId(), r.getAnalystName(),
                r.getRating(), r.getComment(), r.getSubmittedBy(), r.getCreatedAt());
    }
}
