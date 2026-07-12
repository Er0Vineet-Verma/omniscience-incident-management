package com.ims.kb;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ims.audit.AuditService;
import com.ims.common.enums.AuditAction;
import com.ims.common.enums.Audience;
import com.ims.common.exception.NotFoundException;
import com.ims.kb.dto.KbRequest;
import com.ims.kb.dto.KbResponse;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class KnowledgeBaseService {

    private static final String ENTITY_TYPE = "KB_ARTICLE";

    private final KnowledgeBaseRepository knowledgeBaseRepository;
    private final AuditService auditService;

    @Transactional
    public KbResponse create(KbRequest request, String performedBy) {
        KnowledgeBaseArticle article = KnowledgeBaseArticle.builder()
                .title(request.title())
                .issueDescription(request.issueDescription())
                .rootCause(request.rootCause())
                .resolution(request.resolution())
                .keywords(normalizeKeywords(request.keywords()))
                .audience(request.audience() != null ? request.audience() : Audience.INTERNAL)
                .createdBy(performedBy)
                .createdAt(LocalDateTime.now())
                .build();

        article = knowledgeBaseRepository.save(article);
        article.setKbNumber("KB-" + (100 + article.getId()));
        article = knowledgeBaseRepository.save(article);

        auditService.record(ENTITY_TYPE, article.getId(), AuditAction.CREATED,
                null, null, article.getKbNumber() + ": " + article.getTitle(), performedBy);

        return KbResponse.from(article);
    }

    @Transactional
    public KbResponse update(Long id, KbRequest request, String performedBy) {
        KnowledgeBaseArticle article = findArticle(id);

        article.setTitle(request.title());
        article.setIssueDescription(request.issueDescription());
        article.setRootCause(request.rootCause());
        article.setResolution(request.resolution());
        article.setKeywords(normalizeKeywords(request.keywords()));
        if (request.audience() != null) {
            article.setAudience(request.audience());
        }

        article = knowledgeBaseRepository.save(article);

        auditService.record(ENTITY_TYPE, article.getId(), AuditAction.UPDATED,
                null, null, article.getKbNumber() + ": " + article.getTitle(), performedBy);

        return KbResponse.from(article);
    }

    @Transactional
    public void delete(Long id, String performedBy) {
        KnowledgeBaseArticle article = findArticle(id);
        knowledgeBaseRepository.delete(article);

        auditService.record(ENTITY_TYPE, id, AuditAction.DELETED,
                null, article.getKbNumber() + ": " + article.getTitle(), null, performedBy);
    }

    @Transactional(readOnly = true)
    public KbResponse get(Long id) {
        return KbResponse.from(findArticle(id));
    }

    @Transactional(readOnly = true)
    public List<KbResponse> list() {
        return knowledgeBaseRepository.findAll().stream()
                .map(KbResponse::from)
                .toList();
    }

    /** Customer-facing Help Center: only CUSTOMER + BOTH articles (legacy null audience is internal). */
    @Transactional(readOnly = true)
    public List<KbResponse> listForCustomer() {
        return knowledgeBaseRepository.findAll().stream()
                .filter(article -> article.getAudience() == Audience.CUSTOMER
                        || article.getAudience() == Audience.BOTH)
                .map(KbResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<KbResponse> match(String text) {
        if (text == null || text.isBlank()) {
            return List.of();
        }
        String lowerText = text.toLowerCase();
        Set<String> textWords = tokenize(lowerText);

        return knowledgeBaseRepository.findAll().stream()
                .map(article -> Map.entry(article, scoreArticle(article, lowerText, textWords)))
                .filter(entry -> entry.getValue() > 0)
                .sorted(Comparator.comparingLong((Map.Entry<KnowledgeBaseArticle, Long> entry) -> entry.getValue())
                        .reversed())
                .map(entry -> KbResponse.from(entry.getKey()))
                .toList();
    }

    @Transactional
    public void incrementUsage(Long id) {
        KnowledgeBaseArticle article = findArticle(id);
        article.setTimesUsed(article.getTimesUsed() + 1);
        knowledgeBaseRepository.save(article);
    }

    private long scoreArticle(KnowledgeBaseArticle article, String lowerText, Set<String> textWords) {
        long hits = 0;
        if (article.getKeywords() != null && !article.getKeywords().isBlank()) {
            hits += Arrays.stream(article.getKeywords().split(","))
                    .map(keyword -> keyword.trim().toLowerCase())
                    .filter(keyword -> !keyword.isBlank() && lowerText.contains(keyword))
                    .count();
        }
        if (article.getTitle() != null) {
            hits += tokenize(article.getTitle().toLowerCase()).stream()
                    .filter(word -> word.length() > 2 && textWords.contains(word))
                    .count();
        }
        return hits;
    }

    private Set<String> tokenize(String lowerText) {
        return Arrays.stream(lowerText.split("[^a-z0-9]+"))
                .filter(word -> !word.isBlank())
                .collect(Collectors.toSet());
    }

    private String normalizeKeywords(String keywords) {
        if (keywords == null || keywords.isBlank()) {
            return null;
        }
        return Arrays.stream(keywords.split(","))
                .map(keyword -> keyword.trim().toLowerCase())
                .filter(keyword -> !keyword.isBlank())
                .collect(Collectors.joining(","));
    }

    private KnowledgeBaseArticle findArticle(Long id) {
        return knowledgeBaseRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Knowledge base article not found with id: " + id));
    }
}
