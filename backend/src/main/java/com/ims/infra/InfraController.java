package com.ims.infra;

import java.io.File;
import java.lang.management.ManagementFactory;
import java.lang.management.MemoryMXBean;
import java.lang.management.RuntimeMXBean;
import java.lang.management.ThreadMXBean;
import java.time.LocalDateTime;

import org.springframework.core.env.Environment;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ims.sla.SlaMonitorScheduler;
import com.sun.management.OperatingSystemMXBean;

import lombok.RequiredArgsConstructor;

/** Live JVM / database / host telemetry backing the Infrastructure System Health screen. */
@RestController
@RequestMapping("/api/infra")
@RequiredArgsConstructor
public class InfraController {

    private final JdbcTemplate jdbcTemplate;
    private final Environment environment;
    private final SlaMonitorScheduler slaMonitorScheduler;

    public record InfraMetrics(
            long uptimeSeconds,
            double cpuLoadPercent,
            long heapUsedMb,
            long heapMaxMb,
            int threadCount,
            int availableProcessors,
            long diskFreeGb,
            long diskTotalGb,
            String dbStatus,
            long dbLatencyMs,
            String dbProfile,
            String osName,
            String javaVersion,
            boolean slaSchedulerEnabled,
            String slaLastSweepAt,
            int slaLastSweepOverdue
    ) {
    }

    @GetMapping("/metrics")
    @PreAuthorize("hasAnyRole('ANALYST', 'ADMIN')")
    public ResponseEntity<InfraMetrics> metrics() {
        RuntimeMXBean runtime = ManagementFactory.getRuntimeMXBean();
        MemoryMXBean memory = ManagementFactory.getMemoryMXBean();
        ThreadMXBean threads = ManagementFactory.getThreadMXBean();
        OperatingSystemMXBean os = (OperatingSystemMXBean) ManagementFactory.getOperatingSystemMXBean();

        String dbStatus;
        long dbLatencyMs;
        long started = System.nanoTime();
        try {
            jdbcTemplate.queryForObject("SELECT 1", Integer.class);
            dbLatencyMs = Math.max(1, (System.nanoTime() - started) / 1_000_000);
            dbStatus = "UP";
        } catch (Exception e) {
            dbLatencyMs = (System.nanoTime() - started) / 1_000_000;
            dbStatus = "DOWN";
        }

        double cpu = os.getCpuLoad();
        File root = new File(".");
        String[] profiles = environment.getActiveProfiles();
        LocalDateTime lastSweep = slaMonitorScheduler.getLastSweepAt();

        InfraMetrics metrics = new InfraMetrics(
                runtime.getUptime() / 1000,
                cpu >= 0 ? Math.round(cpu * 1000.0) / 10.0 : 0.0,
                memory.getHeapMemoryUsage().getUsed() / (1024 * 1024),
                memory.getHeapMemoryUsage().getMax() / (1024 * 1024),
                threads.getThreadCount(),
                Runtime.getRuntime().availableProcessors(),
                root.getFreeSpace() / (1024 * 1024 * 1024),
                root.getTotalSpace() / (1024 * 1024 * 1024),
                dbStatus,
                dbLatencyMs,
                profiles.length > 0 ? profiles[0] : "default",
                System.getProperty("os.name"),
                System.getProperty("java.version"),
                true,
                lastSweep != null ? lastSweep.toString() : null,
                slaMonitorScheduler.getLastSweepOverdueCount()
        );
        return ResponseEntity.ok(metrics);
    }
}
