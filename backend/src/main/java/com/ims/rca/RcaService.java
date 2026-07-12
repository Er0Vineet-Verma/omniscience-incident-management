package com.ims.rca;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ims.common.enums.LogLevel;
import com.ims.common.exception.NotFoundException;
import com.ims.incident.IncidentRepository;
import com.ims.kb.KnowledgeBaseArticle;
import com.ims.kb.KnowledgeBaseRepository;
import com.ims.logs.LogEntry;
import com.ims.logs.LogEntryRepository;
import com.ims.logs.LogParserService;
import com.ims.rca.dto.KbMatch;
import com.ims.rca.dto.RcaFinding;
import com.ims.rca.dto.RcaResult;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class RcaService {

    private static final List<RcaRule> RULES = List.of(
            new RcaRule(
                    "Database connection timeout",
                    "(?=.*timeout)(?=.*(?:database|\\bdb\\b|\\bsql\\b|connection))",
                    5,
                    "Possible database connectivity issue",
                    List.of(
                            "Check database availability",
                            "Check network latency between application and database",
                            "Review connection pool size and utilization")),
            new RcaRule(
                    "Authentication failures",
                    "login\\s*fail|authentication|unauthorized|invalid credentials",
                    5,
                    "Authentication service failure",
                    List.of(
                            "Check authentication service health",
                            "Verify token expiry configuration",
                            "Check identity provider availability")),
            new RcaRule(
                    "Memory exhaustion",
                    "out of memory|outofmemoryerror|heap",
                    1,
                    "Memory exhaustion / possible leak",
                    List.of(
                            "Capture and analyze a heap dump",
                            "Increase JVM heap size (-Xmx)",
                            "Review caching configuration and object retention")),
            new RcaRule(
                    "Downstream connection refused",
                    "connection refused",
                    3,
                    "Downstream service unavailable",
                    List.of(
                            "Check downstream service status",
                            "Verify ports and endpoint configuration",
                            "Check firewall rules")),
            new RcaRule(
                    "Disk space exhaustion",
                    "\\bdisk\\b|no space left",
                    1,
                    "Disk space exhaustion",
                    List.of(
                            "Free up disk space (rotate or archive logs, clear temp files)",
                            "Expand disk capacity",
                            "Configure log rotation and retention policies")));

    private static final int HIGH_ERROR_VOLUME_THRESHOLD = 20;

    /** Simple keywords counted across ERROR/WARN messages; the top one drives the KB lookup. */
    private static final List<String> KB_KEYWORDS = List.of(
            "timeout", "database", "sql", "connection refused", "connection",
            "authentication", "unauthorized", "invalid credentials", "login",
            "out of memory", "heap", "memory", "disk", "no space left");

    private record CompiledRule(RcaRule rule, Pattern pattern) {
    }

    private static final List<CompiledRule> COMPILED_RULES = RULES.stream()
            .map(rule -> new CompiledRule(rule,
                    Pattern.compile(rule.keywordPattern(), Pattern.CASE_INSENSITIVE)))
            .toList();

    private final IncidentRepository incidentRepository;
    private final LogEntryRepository logEntryRepository;
    private final KnowledgeBaseRepository knowledgeBaseRepository;
    private final LogParserService logParserService;

    @Transactional
    public RcaResult analyzeIncident(Long incidentId) {
        if (!incidentRepository.existsById(incidentId)) {
            throw new NotFoundException("Incident not found with id: " + incidentId);
        }
        List<LogEntry> entries = logEntryRepository.findByIncidentId(incidentId);
        return analyze(entries, incidentId);
    }

    @Transactional
    public RcaResult analyzeLogs(List<String> rawLines) {
        List<LogEntry> entries = logParserService.parse(rawLines == null ? List.of() : rawLines);
        return analyze(entries, null);
    }

    private RcaResult analyze(List<LogEntry> entries, Long incidentId) {
        int errorCount = 0;
        int warnCount = 0;
        List<String> analyzedMessages = new ArrayList<>();
        for (LogEntry entry : entries) {
            LogLevel level = entry.getLogLevel();
            if (level == LogLevel.ERROR || level == LogLevel.FATAL) {
                errorCount++;
                if (entry.getMessage() != null) {
                    analyzedMessages.add(entry.getMessage().toLowerCase(Locale.ROOT));
                }
            } else if (level == LogLevel.WARN) {
                warnCount++;
                if (entry.getMessage() != null) {
                    analyzedMessages.add(entry.getMessage().toLowerCase(Locale.ROOT));
                }
            }
        }

        List<RcaFinding> findings = new ArrayList<>();
        for (CompiledRule compiled : COMPILED_RULES) {
            int matches = 0;
            for (String message : analyzedMessages) {
                if (compiled.pattern().matcher(message).find()) {
                    matches++;
                }
            }
            if (matches >= compiled.rule().threshold()) {
                findings.add(new RcaFinding(
                        compiled.rule().name(),
                        matches,
                        compiled.rule().suggestedCause(),
                        compiled.rule().suggestedActions()));
            }
        }

        if (errorCount > HIGH_ERROR_VOLUME_THRESHOLD) {
            findings.add(new RcaFinding(
                    "High error volume",
                    errorCount,
                    "High error volume — consider raising priority to P1",
                    List.of(
                            "Raise incident priority to P1",
                            "Engage the on-call engineer",
                            "Notify stakeholders of potential widespread impact")));
        }

        List<KbMatch> kbMatches = new ArrayList<>();
        String topKeyword = findTopKeyword(analyzedMessages);
        if (topKeyword != null) {
            List<KnowledgeBaseArticle> articles = knowledgeBaseRepository
                    .findByTitleContainingIgnoreCaseOrKeywordsContainingIgnoreCase(topKeyword, topKeyword);
            for (KnowledgeBaseArticle article : articles) {
                article.setTimesUsed(article.getTimesUsed() + 1);
                kbMatches.add(new KbMatch(article.getKbNumber(), article.getTitle(), article.getResolution()));
            }
            knowledgeBaseRepository.saveAll(articles);
        }

        return new RcaResult(incidentId, entries.size(), errorCount, warnCount, findings, kbMatches);
    }

    private String findTopKeyword(List<String> lowerCasedMessages) {
        Map<String, Integer> hits = new LinkedHashMap<>();
        for (String keyword : KB_KEYWORDS) {
            int count = 0;
            for (String message : lowerCasedMessages) {
                if (message.contains(keyword)) {
                    count++;
                }
            }
            if (count > 0) {
                hits.put(keyword, count);
            }
        }
        String topKeyword = null;
        int best = 0;
        for (Map.Entry<String, Integer> entry : hits.entrySet()) {
            if (entry.getValue() > best) {
                best = entry.getValue();
                topKeyword = entry.getKey();
            }
        }
        return topKeyword;
    }
}
