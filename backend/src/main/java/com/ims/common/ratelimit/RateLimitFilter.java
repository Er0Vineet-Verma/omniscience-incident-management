package com.ims.common.ratelimit;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ims.common.exception.ErrorResponse;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;

/**
 * Per-IP token-bucket rate limiting for {@code /api/**} endpoints. In-memory and
 * single-instance by design (no Redis on this deployment); swap the bucket store
 * for a distributed one if the app is ever scaled horizontally.
 *
 * <p>Limits (configurable via {@code app.ratelimit.*}):
 * <ul>
 *   <li>auth    ({@code /api/auth/**})     5 requests / 15 min</li>
 *   <li>upload  ({@code /api/logs/upload}) 5 requests / 1 min</li>
 *   <li>general (everything else)          60 requests / 1 min</li>
 * </ul>
 * Exhaustion returns {@code 429 Too Many Requests} with a {@code Retry-After} header.
 */
@Component
@RequiredArgsConstructor
public class RateLimitFilter extends OncePerRequestFilter {

    private static final int MAX_TRACKED_KEYS = 100_000;

    private final ObjectMapper objectMapper;

    @Value("${app.ratelimit.enabled:true}")
    private boolean enabled;
    @Value("${app.ratelimit.auth-capacity:5}")
    private long authCapacity;
    @Value("${app.ratelimit.auth-window-minutes:15}")
    private long authWindowMinutes;
    @Value("${app.ratelimit.upload-capacity:5}")
    private long uploadCapacity;
    @Value("${app.ratelimit.upload-window-seconds:60}")
    private long uploadWindowSeconds;
    @Value("${app.ratelimit.general-capacity:60}")
    private long generalCapacity;
    @Value("${app.ratelimit.general-window-seconds:60}")
    private long generalWindowSeconds;

    private final ConcurrentHashMap<String, Bucket> buckets = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain) throws ServletException, IOException {
        String uri = request.getRequestURI();
        if (!enabled || uri == null || !uri.startsWith("/api/")) {
            filterChain.doFilter(request, response);
            return;
        }

        Category category = categorize(uri);
        String key = clientIp(request) + ":" + category.name();
        Bucket bucket = bucketFor(key, category);

        if (bucket.tryConsume()) {
            filterChain.doFilter(request, response);
        } else {
            writeTooManyRequests(response, bucket.retryAfterSeconds());
        }
    }

    private Bucket bucketFor(String key, Category category) {
        if (buckets.size() > MAX_TRACKED_KEYS) {
            buckets.clear(); // crude backstop against unbounded growth / memory exhaustion
        }
        return buckets.computeIfAbsent(key, k -> switch (category) {
            case AUTH -> new Bucket(authCapacity, authWindowMinutes * 60_000_000_000L);
            case UPLOAD -> new Bucket(uploadCapacity, uploadWindowSeconds * 1_000_000_000L);
            case GENERAL -> new Bucket(generalCapacity, generalWindowSeconds * 1_000_000_000L);
        });
    }

    private Category categorize(String uri) {
        if (uri.startsWith("/api/auth/")) {
            return Category.AUTH;
        }
        if (uri.equals("/api/logs/upload")) {
            return Category.UPLOAD;
        }
        return Category.GENERAL;
    }

    private String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private void writeTooManyRequests(HttpServletResponse response, long retryAfterSeconds) throws IOException {
        long retry = Math.max(1, retryAfterSeconds);
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setHeader("Retry-After", String.valueOf(retry));
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        ErrorResponse body = new ErrorResponse(HttpStatus.TOO_MANY_REQUESTS.value(), "Too Many Requests",
                "Rate limit exceeded. Retry after " + retry + " seconds.", LocalDateTime.now());
        objectMapper.writeValue(response.getOutputStream(), body);
    }

    private enum Category { AUTH, UPLOAD, GENERAL }

    /** Continuous-refill token bucket. Thread-safe via synchronized methods. */
    private static final class Bucket {
        private final double capacity;
        private final double refillTokensPerNano;
        private double tokens;
        private long lastRefillNanos;

        Bucket(long capacity, long refillPeriodNanos) {
            this.capacity = capacity;
            this.refillTokensPerNano = (double) capacity / refillPeriodNanos;
            this.tokens = capacity;
            this.lastRefillNanos = System.nanoTime();
        }

        synchronized boolean tryConsume() {
            refill();
            if (tokens >= 1.0) {
                tokens -= 1.0;
                return true;
            }
            return false;
        }

        synchronized long retryAfterSeconds() {
            refill();
            if (tokens >= 1.0) {
                return 0;
            }
            double deficit = 1.0 - tokens;
            double nanos = deficit / refillTokensPerNano;
            return (long) Math.ceil(nanos / 1_000_000_000.0);
        }

        private void refill() {
            long now = System.nanoTime();
            double added = (now - lastRefillNanos) * refillTokensPerNano;
            if (added > 0) {
                tokens = Math.min(capacity, tokens + added);
                lastRefillNanos = now;
            }
        }
    }
}
