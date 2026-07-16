package com.ims.config;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import com.ims.common.enums.IncidentStatus;
import com.ims.common.enums.LogLevel;
import com.ims.common.enums.Priority;
import com.ims.common.enums.Role;
import com.ims.common.enums.UserStatus;
import com.ims.escalation.Escalation;
import com.ims.escalation.EscalationRepository;
import com.ims.incident.Incident;
import com.ims.incident.IncidentRepository;
import com.ims.kb.KnowledgeBaseArticle;
import com.ims.kb.KnowledgeBaseRepository;
import com.ims.logs.LogEntry;
import com.ims.logs.LogEntryRepository;
import com.ims.sla.SlaRule;
import com.ims.sla.SlaRuleRepository;
import com.ims.user.User;
import com.ims.user.UserRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Seeds demo data on first startup. Every block is idempotent: it only runs
 * when the corresponding table is empty, so restarting the application never
 * duplicates data.
 *
 * Dev and test profiles only: a production (mysql) deployment must never
 * boot with the publicly documented demo accounts.
 */
@Component
@Profile({"dev", "test"})
@RequiredArgsConstructor
@Slf4j
public class DataSeeder implements CommandLineRunner {

    private static final String SEED_SOURCE = "seed-data.log";
    private static final String ADMIN_EMAIL = "admin@ims.com";

    private final UserRepository userRepository;
    private final SlaRuleRepository slaRuleRepository;
    private final IncidentRepository incidentRepository;
    private final LogEntryRepository logEntryRepository;
    private final EscalationRepository escalationRepository;
    private final KnowledgeBaseRepository knowledgeBaseRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        int slaRules = seedSlaRules();
        int users = seedUsers();
        int incidents = seedIncidents();
        int logs = seedLogs();
        int kbArticles = seedKnowledgeBase();

        log.info("DataSeeder finished: {} SLA rules, {} users, {} incidents, {} log entries, {} KB articles seeded "
                        + "(0 = table already had data, block skipped).",
                slaRules, users, incidents, logs, kbArticles);
    }

    // ------------------------------------------------------------------ SLA

    private int seedSlaRules() {
        if (slaRuleRepository.count() > 0) {
            return 0;
        }
        List<SlaRule> rules = List.of(
                SlaRule.builder().priority(Priority.P1).resolutionTimeHours(4).build(),
                SlaRule.builder().priority(Priority.P2).resolutionTimeHours(8).build(),
                SlaRule.builder().priority(Priority.P3).resolutionTimeHours(24).build(),
                SlaRule.builder().priority(Priority.P4).resolutionTimeHours(72).build());
        slaRuleRepository.saveAll(rules);
        return rules.size();
    }

    // ---------------------------------------------------------------- Users

    private int seedUsers() {
        if (userRepository.count() > 0) {
            return 0;
        }
        LocalDateTime now = LocalDateTime.now();
        List<User> users = List.of(
                user("System Admin", ADMIN_EMAIL, "Admin@123", Role.ADMIN, now),
                user("Analyst One", "analyst1@ims.com", "Analyst@123", Role.ANALYST, now),
                user("Analyst Two", "analyst2@ims.com", "Analyst@123", Role.ANALYST, now),
                user("Analyst Three", "analyst3@ims.com", "Analyst@123", Role.ANALYST, now),
                user("Demo Customer", "customer@ims.com", "Customer@123", Role.CUSTOMER, now));
        userRepository.saveAll(users);
        return users.size();
    }

    private User user(String name, String email, String rawPassword, Role role, LocalDateTime createdAt) {
        return User.builder()
                .name(name)
                .email(email)
                .password(passwordEncoder.encode(rawPassword))
                .role(role)
                .status(UserStatus.ACTIVE)
                .createdAt(createdAt)
                .build();
    }

    // ------------------------------------------------------------ Incidents

    private int seedIncidents() {
        if (incidentRepository.count() > 0) {
            return 0;
        }
        User admin = userRepository.findByEmail(ADMIN_EMAIL).orElse(null);
        User customer = userRepository.findByEmail("customer@ims.com").orElse(null);
        List<User> analysts = userRepository.findByRoleAndStatus(Role.ANALYST, UserStatus.ACTIVE);
        if (admin == null || customer == null || analysts.isEmpty()) {
            log.warn("DataSeeder: users missing, skipping incident seeding.");
            return 0;
        }

        LocalDateTime now = LocalDateTime.now();
        int n = 0;

        // --- Older, completed incidents (spread over the last ~20 days) ---

        Incident i1 = incident(++n, "Production login failure for all users",
                "Users could not log in to the customer portal; identity provider returned HTTP 503.",
                Priority.P1, IncidentStatus.CLOSED, now.minusDays(20), 4,
                analysts.get(0 % analysts.size()), customer);
        i1.setResolvedAt(i1.getCreatedAt().plusHours(3));
        i1.setClosedAt(i1.getCreatedAt().plusHours(5));
        i1.setResolutionNotes("Restarted the identity service cluster and rotated the expired signing certificate.");
        i1.setRootCause("Expired TLS certificate on the identity provider broke the authentication handshake.");

        Incident i2 = incident(++n, "Database connection timeout on orders service",
                "Orders service threw repeated 'Connection is not available' errors; checkout requests timed out.",
                Priority.P2, IncidentStatus.CLOSED, now.minusDays(18), 8,
                analysts.get(1 % analysts.size()), admin);
        i2.setResolvedAt(i2.getCreatedAt().plusHours(6));
        i2.setClosedAt(i2.getCreatedAt().plusDays(1));
        i2.setResolutionNotes("Increased HikariCP pool size from 10 to 30 and tuned connection timeout.");
        i2.setRootCause("Connection pool exhaustion under peak load; pool size was undersized for traffic volume.");

        Incident i3 = incident(++n, "Payment API responding slowly during peak hours",
                "Third-party payment gateway latency exceeded 8 seconds between 18:00 and 20:00.",
                Priority.P3, IncidentStatus.RESOLVED, now.minusDays(15), 24,
                analysts.get(2 % analysts.size()), customer);
        i3.setResolvedAt(i3.getCreatedAt().plusHours(20));
        i3.setResolutionNotes("Enabled response caching for idempotent calls and raised the client timeout.");
        i3.setRootCause("Upstream payment provider throttling combined with missing client-side caching.");

        Incident i4 = incident(++n, "Disk full on application server app-02",
                "Application server app-02 reached 100% disk usage; service writes started failing.",
                Priority.P2, IncidentStatus.RESOLVED, now.minusDays(12), 8,
                analysts.get(3 % analysts.size()), admin);
        i4.setResolvedAt(i4.getCreatedAt().plusHours(7));
        i4.setResolutionNotes("Purged rotated logs, archived old heap dumps, and enabled daily log rotation.");
        i4.setRootCause("Log rotation was disabled after the last deployment, filling /var/log within days.");

        Incident i5 = incident(++n, "Typo on the password reset email template",
                "Password reset email greeting reads 'Dear Costumer' instead of 'Dear Customer'.",
                Priority.P4, IncidentStatus.CLOSED, now.minusDays(11), 72,
                analysts.get(4 % analysts.size()), customer);
        i5.setResolvedAt(i5.getCreatedAt().plusHours(30));
        i5.setClosedAt(i5.getCreatedAt().plusDays(2));
        i5.setResolutionNotes("Fixed the template text and redeployed the notification service.");
        i5.setRootCause("Copy error introduced in the last template update; no review step for email content.");

        Incident i6 = incident(++n, "Report generation crashes for large date ranges",
                "Monthly report export throws OutOfMemoryError when the range exceeds 90 days.",
                Priority.P3, IncidentStatus.RESOLVED, now.minusDays(9), 24,
                analysts.get(5 % analysts.size()), customer);
        i6.setResolvedAt(i6.getCreatedAt().plusHours(22));
        i6.setResolutionNotes("Switched the export to streaming/pagination instead of loading all rows in memory.");
        i6.setRootCause("Report engine materialised the full result set in heap before writing the file.");

        // --- Deliberately breached incident (still in progress, past its deadline) ---

        Incident i7 = incident(++n, "SSL certificate renewal failing on API gateway",
                "Automated certificate renewal job fails; gateway certificate expires soon and retries keep erroring.",
                Priority.P2, IncidentStatus.IN_PROGRESS, now.minusDays(2), 8,
                analysts.get(6 % analysts.size()), admin);
        i7.setSlaBreached(true);
        i7.setEscalationLevel(1);

        // --- Active incidents within SLA ---

        Incident i8 = incident(++n, "Search indexing lagging behind by several hours",
                "Newly created incidents take up to 6 hours to appear in search results.",
                Priority.P3, IncidentStatus.PENDING, now.minusHours(12), 24,
                analysts.get(7 % analysts.size()), customer);

        Incident i9 = incident(++n, "Checkout service returning HTTP 500 for EU region",
                "All checkout attempts from EU customers fail with internal server error since the last deploy.",
                Priority.P1, IncidentStatus.OPEN, now.minusHours(1), 4,
                analysts.get(8 % analysts.size()), customer);

        Incident i10 = incident(++n, "Authentication service intermittent failures",
                "Roughly 5% of login attempts fail with timeout errors; retries usually succeed.",
                Priority.P1, IncidentStatus.OPEN, now.minusHours(2), 4,
                analysts.get(9 % analysts.size()), admin);

        Incident i11 = incident(++n, "Request: export audit trail to CSV",
                "Compliance team asks for a CSV export button on the audit trail screen.",
                Priority.P4, IncidentStatus.OPEN, now.minusDays(1), 72,
                analysts.get(10 % analysts.size()), customer);

        Incident i12 = incident(++n, "Email notifications delayed by 30 minutes",
                "Incident assignment emails arrive with a consistent ~30 minute delay.",
                Priority.P2, IncidentStatus.IN_PROGRESS, now.minusHours(4), 8,
                analysts.get(11 % analysts.size()), admin);

        List<Incident> incidents = List.of(i1, i2, i3, i4, i5, i6, i7, i8, i9, i10, i11, i12);
        incidentRepository.saveAll(incidents);

        // Matching escalation row for the breached incident (level 1 -> TEAM_LEAD).
        if (escalationRepository.count() == 0) {
            escalationRepository.save(Escalation.builder()
                    .incident(i7)
                    .level(1)
                    .escalatedTo("TEAM_LEAD")
                    .reason("SLA breached: P2 unresolved past deadline")
                    .escalatedAt(i7.getSlaDeadline().plusMinutes(5))
                    .build());
        }
        return incidents.size();
    }

    private Incident incident(int n, String title, String description, Priority priority,
                              IncidentStatus status, LocalDateTime createdAt, int slaHours,
                              User assignedTo, User createdBy) {
        return Incident.builder()
                .incidentNumber("INC-" + String.format("%05d", 1000 + n))
                .title(title)
                .description(description)
                .priority(priority)
                .status(status)
                .createdAt(createdAt)
                .updatedAt(createdAt)
                .slaDeadline(createdAt.plusHours(slaHours))
                .assignedTo(assignedTo)
                .createdBy(createdBy)
                .build();
    }

    // ----------------------------------------------------------------- Logs

    private int seedLogs() {
        if (logEntryRepository.count() > 0) {
            return 0;
        }
        Incident dbIncident = incidentRepository.findByIncidentNumber("INC-01002").orElse(null);
        Incident sslIncident = incidentRepository.findByIncidentNumber("INC-01007").orElse(null);
        Incident checkoutIncident = incidentRepository.findByIncidentNumber("INC-01009").orElse(null);
        if (dbIncident == null || sslIncident == null || checkoutIncident == null) {
            log.warn("DataSeeder: seed incidents missing, skipping log seeding.");
            return 0;
        }

        List<LogEntry> entries = new java.util.ArrayList<>();

        // Logs for the database timeout incident (INC-01002).
        LocalDateTime t1 = dbIncident.getCreatedAt().minusMinutes(40);
        entries.add(logEntry(dbIncident, t1, LogLevel.INFO, "Orders service started, connection pool size=10"));
        entries.add(logEntry(dbIncident, t1.plusMinutes(5), LogLevel.INFO, "Health check passed for datasource 'orders-db'"));
        entries.add(logEntry(dbIncident, t1.plusMinutes(12), LogLevel.WARN, "HikariPool-1 - Connection acquisition took 8123ms"));
        entries.add(logEntry(dbIncident, t1.plusMinutes(18), LogLevel.WARN, "Slow query detected: SELECT * FROM orders WHERE status='PENDING' (4.2s)"));
        entries.add(logEntry(dbIncident, t1.plusMinutes(25), LogLevel.ERROR, "Database connection timeout after 30s"));
        entries.add(logEntry(dbIncident, t1.plusMinutes(26), LogLevel.ERROR, "HikariPool-1 - Connection is not available, request timed out after 30001ms"));
        entries.add(logEntry(dbIncident, t1.plusMinutes(27), LogLevel.INFO, "Retry triggered for order submission id=98213"));
        entries.add(logEntry(dbIncident, t1.plusMinutes(28), LogLevel.ERROR, "Database connection timeout after 30s"));
        entries.add(logEntry(dbIncident, t1.plusMinutes(33), LogLevel.ERROR, "Transaction rollback: could not obtain JDBC connection"));
        entries.add(logEntry(dbIncident, t1.plusMinutes(40), LogLevel.WARN, "Circuit breaker 'orders-db' moved to OPEN state"));

        // Logs for the failing SSL renewal / breached incident (INC-01007).
        LocalDateTime t2 = sslIncident.getCreatedAt().minusMinutes(30);
        entries.add(logEntry(sslIncident, t2, LogLevel.INFO, "Certificate renewal job started for gateway.ims.local"));
        entries.add(logEntry(sslIncident, t2.plusMinutes(2), LogLevel.WARN, "Certificate for gateway.ims.local expires in 5 days"));
        entries.add(logEntry(sslIncident, t2.plusMinutes(3), LogLevel.ERROR, "ACME challenge failed: DNS record _acme-challenge not found"));
        entries.add(logEntry(sslIncident, t2.plusMinutes(4), LogLevel.ERROR, "Certificate renewal failed, will retry in 60 minutes"));
        entries.add(logEntry(sslIncident, t2.plusMinutes(10), LogLevel.INFO, "Retry triggered for certificate renewal"));
        entries.add(logEntry(sslIncident, t2.plusMinutes(13), LogLevel.ERROR, "ACME challenge failed: DNS record _acme-challenge not found"));
        entries.add(logEntry(sslIncident, t2.plusMinutes(20), LogLevel.WARN, "TLS handshake using certificate that expires in 5 days"));
        entries.add(logEntry(sslIncident, t2.plusMinutes(25), LogLevel.ERROR, "Certificate renewal failed, will retry in 60 minutes"));
        entries.add(logEntry(sslIncident, t2.plusMinutes(28), LogLevel.INFO, "Alert notification sent to ops channel"));
        entries.add(logEntry(sslIncident, t2.plusMinutes(30), LogLevel.WARN, "Renewal job exceeded 3 consecutive failures"));

        // Logs for the checkout outage incident (INC-01009).
        LocalDateTime t3 = checkoutIncident.getCreatedAt().minusMinutes(20);
        entries.add(logEntry(checkoutIncident, t3, LogLevel.INFO, "Deployment checkout-service:2.14.0 completed on eu-west cluster"));
        entries.add(logEntry(checkoutIncident, t3.plusMinutes(2), LogLevel.INFO, "Feature flag 'new-tax-engine' enabled for region EU"));
        entries.add(logEntry(checkoutIncident, t3.plusMinutes(4), LogLevel.ERROR, "NullPointerException at TaxCalculator.calculate(TaxCalculator.java:88)"));
        entries.add(logEntry(checkoutIncident, t3.plusMinutes(5), LogLevel.ERROR, "HTTP 500 returned for POST /api/checkout (region=EU)"));
        entries.add(logEntry(checkoutIncident, t3.plusMinutes(6), LogLevel.WARN, "Error rate for /api/checkout exceeded 50% over the last 5 minutes"));
        entries.add(logEntry(checkoutIncident, t3.plusMinutes(7), LogLevel.ERROR, "HTTP 500 returned for POST /api/checkout (region=EU)"));
        entries.add(logEntry(checkoutIncident, t3.plusMinutes(8), LogLevel.ERROR, "Login attempt failed for user shopper-eu-441: downstream checkout dependency unavailable"));
        entries.add(logEntry(checkoutIncident, t3.plusMinutes(10), LogLevel.INFO, "Retry triggered for failed checkout batch (12 requests)"));
        entries.add(logEntry(checkoutIncident, t3.plusMinutes(12), LogLevel.ERROR, "NullPointerException at TaxCalculator.calculate(TaxCalculator.java:88)"));
        entries.add(logEntry(checkoutIncident, t3.plusMinutes(15), LogLevel.WARN, "Automatic rollback candidate detected: checkout-service:2.14.0"));

        logEntryRepository.saveAll(entries);
        return entries.size();
    }

    private LogEntry logEntry(Incident incident, LocalDateTime timestamp, LogLevel level, String message) {
        return LogEntry.builder()
                .incident(incident)
                .timestamp(timestamp)
                .logLevel(level)
                .message(message)
                .source(SEED_SOURCE)
                .uploadedBy(ADMIN_EMAIL)
                .createdAt(LocalDateTime.now())
                .build();
    }

    // ------------------------------------------------------- Knowledge base

    private int seedKnowledgeBase() {
        if (knowledgeBaseRepository.count() > 0) {
            return 0;
        }
        LocalDateTime now = LocalDateTime.now();
        List<KnowledgeBaseArticle> articles = List.of(
                KnowledgeBaseArticle.builder()
                        .kbNumber("KB-101")
                        .title("Database Connection Timeout")
                        .issueDescription("Application logs show repeated 'Database connection timeout' and "
                                + "'Connection is not available' errors; requests fail or hang.")
                        .rootCause("Connection pool exhaustion: pool size too small for peak load, or connections "
                                + "leaked by long-running transactions.")
                        .resolution("Increase the connection pool maximum size, set a sensible connection timeout, "
                                + "find and fix connection leaks, and add an index for the slowest queries.")
                        .keywords("database,timeout,connection,pool,hikari,jdbc,sql")
                        .createdBy(ADMIN_EMAIL)
                        .createdAt(now)
                        .build(),
                KnowledgeBaseArticle.builder()
                        .kbNumber("KB-102")
                        .title("Authentication Service Failure")
                        .issueDescription("Users cannot log in; identity service returns 5xx errors or token "
                                + "validation fails across applications.")
                        .rootCause("Expired or rotated signing certificate on the identity provider, or the "
                                + "identity service is down/overloaded.")
                        .resolution("Check identity service health, renew/rotate the TLS and token-signing "
                                + "certificates, restart the identity cluster, and verify clock sync (NTP) on all nodes.")
                        .keywords("authentication,login,failed,jwt,token,certificate,identity,sso")
                        .createdBy(ADMIN_EMAIL)
                        .createdAt(now)
                        .build(),
                KnowledgeBaseArticle.builder()
                        .kbNumber("KB-103")
                        .title("Disk Full on Application Server")
                        .issueDescription("Server reports 100% disk usage; application cannot write logs or "
                                + "temporary files and may crash.")
                        .rootCause("Log rotation disabled or misconfigured, oversized heap dumps, or unbounded "
                                + "temporary file growth.")
                        .resolution("Delete or archive old logs and heap dumps, enable daily log rotation with "
                                + "retention limits, and add disk-usage alerts at 80%.")
                        .keywords("disk,full,storage,log,rotation,space,cleanup")
                        .createdBy(ADMIN_EMAIL)
                        .createdAt(now)
                        .build());
        knowledgeBaseRepository.saveAll(articles);
        return articles.size();
    }
}
