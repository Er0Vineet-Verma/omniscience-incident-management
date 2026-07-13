package com.ims.logs;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import com.ims.common.enums.LogLevel;

public interface LogEntryRepository extends JpaRepository<LogEntry, Long>, JpaSpecificationExecutor<LogEntry> {

    List<LogEntry> findByIncidentId(Long incidentId);

    long countByLogLevel(LogLevel logLevel);

    long countByIncidentIdAndLogLevel(Long incidentId, LogLevel logLevel);

    Page<LogEntry> findByMessageContainingIgnoreCase(String message, Pageable pageable);

    long countBySource(String source);
}
