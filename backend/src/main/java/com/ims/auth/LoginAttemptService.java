package com.ims.auth;

import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * In-memory account lockout. After {@code max-attempts} consecutive failed
 * logins for an email the account is locked for {@code window-minutes}; a
 * successful login clears the counter. Complements per-IP rate limiting:
 * rate limiting throttles a single IP, lockout protects one account against
 * a distributed guessing attack.
 */
@Service
public class LoginAttemptService {

    @Value("${app.security.lockout.max-attempts:5}")
    private int maxAttempts;

    @Value("${app.security.lockout.window-minutes:15}")
    private long lockMinutes;

    private final ConcurrentHashMap<String, Attempt> attempts = new ConcurrentHashMap<>();

    public boolean isLocked(String email) {
        Attempt attempt = attempts.get(key(email));
        if (attempt == null) {
            return false;
        }
        if (attempt.lockedUntilEpochMs > 0 && attempt.lockedUntilEpochMs <= System.currentTimeMillis()) {
            attempts.remove(key(email)); // cool-off elapsed
            return false;
        }
        return attempt.lockedUntilEpochMs > System.currentTimeMillis();
    }

    public long secondsUntilUnlock(String email) {
        Attempt attempt = attempts.get(key(email));
        if (attempt == null || attempt.lockedUntilEpochMs <= System.currentTimeMillis()) {
            return 0;
        }
        return (long) Math.ceil((attempt.lockedUntilEpochMs - System.currentTimeMillis()) / 1000.0);
    }

    public void loginFailed(String email) {
        attempts.compute(key(email), (k, existing) -> {
            Attempt attempt = existing != null ? existing : new Attempt();
            attempt.count++;
            if (attempt.count >= maxAttempts) {
                attempt.lockedUntilEpochMs = System.currentTimeMillis() + lockMinutes * 60_000L;
            }
            return attempt;
        });
    }

    public void loginSucceeded(String email) {
        attempts.remove(key(email));
    }

    private String key(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    private static final class Attempt {
        private int count;
        private long lockedUntilEpochMs;
    }
}
