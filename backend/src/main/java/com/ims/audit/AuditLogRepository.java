package com.ims.audit;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import com.ims.common.enums.AuditAction;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    List<AuditLog> findByEntityTypeAndEntityIdOrderByTimestampDesc(String entityType, Long entityId);

    Page<AuditLog> findAllByOrderByTimestampDesc(Pageable pageable);

    long countByTimestampAfter(LocalDateTime timestamp);

    long countByAction(AuditAction action);

    @Query("select count(distinct a.performedBy) from AuditLog a")
    long countDistinctActors();
}
