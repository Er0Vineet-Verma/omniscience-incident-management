package com.ims.kb.dto;

import java.time.LocalDateTime;

import com.ims.common.enums.Audience;
import com.ims.kb.KnowledgeBaseArticle;

public record KbResponse(
        Long id,
        String kbNumber,
        String title,
        String issueDescription,
        String rootCause,
        String resolution,
        String keywords,
        Audience audience,
        String createdBy,
        LocalDateTime createdAt,
        int timesUsed
) {
    public static KbResponse from(KnowledgeBaseArticle article) {
        return new KbResponse(
                article.getId(),
                article.getKbNumber(),
                article.getTitle(),
                article.getIssueDescription(),
                article.getRootCause(),
                article.getResolution(),
                article.getKeywords(),
                article.getAudience() != null ? article.getAudience() : Audience.INTERNAL,
                article.getCreatedBy(),
                article.getCreatedAt(),
                article.getTimesUsed()
        );
    }
}
