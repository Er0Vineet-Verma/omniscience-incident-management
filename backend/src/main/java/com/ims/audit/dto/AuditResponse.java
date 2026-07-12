package com.ims.audit.dto;

import java.time.LocalDateTime;

import com.ims.audit.AuditLog;
import com.ims.common.enums.AuditAction;

public record AuditResponse(
        Long id,
        String entityType,
        Long entityId,
        AuditAction action,
        String fieldName,
        String oldValue,
        String newValue,
        String performedBy,
        LocalDateTime timestamp
) {
    public static AuditResponse from(AuditLog auditLog) {
        return new AuditResponse(
                auditLog.getId(),
                auditLog.getEntityType(),
                auditLog.getEntityId(),
                auditLog.getAction(),
                auditLog.getFieldName(),
                auditLog.getOldValue(),
                auditLog.getNewValue(),
                auditLog.getPerformedBy(),
                auditLog.getTimestamp()
        );
    }
}
