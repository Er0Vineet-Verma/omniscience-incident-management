package com.ims.logs;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.stereotype.Service;

import com.ims.common.enums.LogLevel;

/**
 * Parses uploaded log text line by line into unsaved {@link LogEntry} instances.
 *
 * Supported patterns (tried in order):
 *   a) "2026-06-10 14:23:01[,.123] LEVEL message"
 *   b) "[2026-06-10T14:23:01] [LEVEL] message"
 *   c) "LEVEL message"            (timestamp = now)
 *   d) anything else             (INFO, whole line as message, timestamp = now)
 */
@Service
public class LogParserService {

    private static final int MAX_MESSAGE_LENGTH = 4000;

    private static final String LEVEL_TOKENS = "TRACE|DEBUG|INFO|WARNING|WARN|ERROR|FATAL|SEVERE";

    // a) "2026-06-10 14:23:01,123 ERROR message" (millis optional, ',' or '.')
    private static final Pattern PATTERN_DATE_TIME_LEVEL = Pattern.compile(
            "^(\\d{4}-\\d{2}-\\d{2})\\s+(\\d{2}:\\d{2}:\\d{2})(?:[.,](\\d{1,3}))?\\s+("
                    + LEVEL_TOKENS + ")\\b\\s*(.*)$",
            Pattern.CASE_INSENSITIVE);

    // b) "[2026-06-10T14:23:01] [ERROR] message"
    private static final Pattern PATTERN_BRACKETED = Pattern.compile(
            "^\\[(\\d{4}-\\d{2}-\\d{2})T(\\d{2}:\\d{2}:\\d{2})(?:[.,](\\d{1,3}))?\\]\\s*\\[("
                    + LEVEL_TOKENS + ")\\]\\s*(.*)$",
            Pattern.CASE_INSENSITIVE);

    // c) "ERROR message"
    private static final Pattern PATTERN_LEVEL_ONLY = Pattern.compile(
            "^(" + LEVEL_TOKENS + ")\\b\\s*[:\\-]?\\s*(.*)$",
            Pattern.CASE_INSENSITIVE);

    /**
     * Reads all lines from the given stream (UTF-8).
     */
    public List<String> readLines(InputStream inputStream) throws IOException {
        List<String> lines = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(inputStream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                lines.add(line);
            }
        }
        return lines;
    }

    /**
     * Parses an uploaded text stream line by line. Blank lines are skipped.
     */
    public List<LogEntry> parse(InputStream inputStream) throws IOException {
        return parse(readLines(inputStream));
    }

    /**
     * Parses raw lines into unsaved {@link LogEntry} instances. Blank lines are skipped.
     */
    public List<LogEntry> parse(List<String> lines) {
        List<LogEntry> entries = new ArrayList<>();
        if (lines == null) {
            return entries;
        }
        for (String line : lines) {
            if (line == null || line.isBlank()) {
                continue;
            }
            entries.add(parseLine(line.trim()));
        }
        return entries;
    }

    /**
     * Parses a single non-blank line, falling back to INFO/now when no pattern matches.
     */
    public LogEntry parseLine(String line) {
        Matcher matcher = PATTERN_DATE_TIME_LEVEL.matcher(line);
        if (matcher.matches()) {
            LocalDateTime timestamp = toTimestamp(matcher.group(1), matcher.group(2), matcher.group(3));
            if (timestamp != null) {
                return buildEntry(timestamp, toLevel(matcher.group(4)), matcher.group(5));
            }
        }

        matcher = PATTERN_BRACKETED.matcher(line);
        if (matcher.matches()) {
            LocalDateTime timestamp = toTimestamp(matcher.group(1), matcher.group(2), matcher.group(3));
            if (timestamp != null) {
                return buildEntry(timestamp, toLevel(matcher.group(4)), matcher.group(5));
            }
        }

        matcher = PATTERN_LEVEL_ONLY.matcher(line);
        if (matcher.matches()) {
            return buildEntry(LocalDateTime.now(), toLevel(matcher.group(1)), matcher.group(2));
        }

        return buildEntry(LocalDateTime.now(), LogLevel.INFO, line);
    }

    private LogEntry buildEntry(LocalDateTime timestamp, LogLevel level, String message) {
        String safeMessage = message == null ? "" : message.trim();
        if (safeMessage.length() > MAX_MESSAGE_LENGTH) {
            safeMessage = safeMessage.substring(0, MAX_MESSAGE_LENGTH);
        }
        return LogEntry.builder()
                .timestamp(timestamp)
                .logLevel(level)
                .message(safeMessage)
                .build();
    }

    private LocalDateTime toTimestamp(String date, String time, String millis) {
        try {
            LocalDate localDate = LocalDate.parse(date);
            LocalTime localTime = LocalTime.parse(time);
            LocalDateTime timestamp = LocalDateTime.of(localDate, localTime);
            if (millis != null && !millis.isEmpty()) {
                // pad to 3 digits: "1" -> 100ms, "12" -> 120ms, "123" -> 123ms
                String padded = String.format("%-3s", millis).replace(' ', '0');
                timestamp = timestamp.withNano(Integer.parseInt(padded) * 1_000_000);
            }
            return timestamp;
        } catch (DateTimeParseException | NumberFormatException ex) {
            return null;
        }
    }

    private LogLevel toLevel(String token) {
        String upper = token.toUpperCase(Locale.ROOT);
        return switch (upper) {
            case "WARNING" -> LogLevel.WARN;
            case "SEVERE" -> LogLevel.FATAL;
            default -> LogLevel.valueOf(upper);
        };
    }
}
