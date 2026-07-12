-- =====================================================================
-- Incident Management & Log Analysis System - MySQL 8 Schema
-- =====================================================================
-- Reference DDL matching the JPA entities in com.ims.* exactly.
-- NOTE: the Spring Boot app runs with spring.jpa.hibernate.ddl-auto=update,
-- so Hibernate also creates/updates this schema automatically. This script
-- exists for manual/standalone database setup and as documentation.
--
-- Charset: utf8mb4 everywhere (full Unicode, incl. emoji in log messages).
-- Engine:  InnoDB (required for FK support).
-- =====================================================================

-- Database name matches the backend default in application-mysql.yml
-- (jdbc:mysql://.../${DB_NAME:imsdb}).
CREATE DATABASE IF NOT EXISTS imsdb
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE imsdb;

-- ---------------------------------------------------------------------
-- 1) users  (com.ims.user.User)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    name        VARCHAR(255) NOT NULL,
    email       VARCHAR(255) NOT NULL,
    password    VARCHAR(255) NOT NULL,              -- bcrypt hash, never plain text
    role        VARCHAR(20)  NOT NULL,              -- ADMIN | ANALYST | CUSTOMER  (EnumType.STRING)
    status      VARCHAR(20)  NOT NULL,              -- ACTIVE | INACTIVE           (EnumType.STRING)
    created_at  DATETIME     NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 2) incidents  (com.ims.incident.Incident)
-- ---------------------------------------------------------------------
-- FK choices:
--   * assigned_to -> users.id  ON DELETE SET NULL : deleting an analyst must
--     not destroy incident history; the incident simply becomes unassigned.
--   * created_by  -> users.id  ON DELETE RESTRICT : an incident without its
--     creator loses accountability/reporting meaning, so user deletion is
--     blocked while they own incidents (the app deactivates users instead
--     of deleting them - UserStatus.INACTIVE).
CREATE TABLE IF NOT EXISTS incidents (
    id                BIGINT       NOT NULL AUTO_INCREMENT,
    incident_number   VARCHAR(20)  NOT NULL,        -- e.g. "INC-01001"
    title             VARCHAR(255) NOT NULL,
    description       TEXT         NULL,
    priority          VARCHAR(5)   NOT NULL,        -- P1 | P2 | P3 | P4 (EnumType.STRING)
    status            VARCHAR(20)  NOT NULL,        -- OPEN | IN_PROGRESS | PENDING | RESOLVED | CLOSED
    created_at        DATETIME     NOT NULL,
    updated_at        DATETIME     NOT NULL,
    resolved_at       DATETIME     NULL,
    closed_at         DATETIME     NULL,
    sla_deadline      DATETIME     NOT NULL,
    sla_breached      BOOLEAN      NOT NULL DEFAULT FALSE,
    escalation_level  INT          NOT NULL DEFAULT 0,
    resolution_notes  TEXT         NULL,
    root_cause        TEXT         NULL,
    assigned_to       BIGINT       NULL,            -- nullable: incident may be unassigned
    created_by        BIGINT       NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_incidents_number (incident_number),
    KEY idx_incidents_status       (status),
    KEY idx_incidents_priority     (priority),
    KEY idx_incidents_sla_deadline (sla_deadline),
    CONSTRAINT fk_incidents_assigned_to
        FOREIGN KEY (assigned_to) REFERENCES users (id)
        ON DELETE SET NULL,
    CONSTRAINT fk_incidents_created_by
        FOREIGN KEY (created_by) REFERENCES users (id)
        ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 3) logs  (com.ims.logs.LogEntry)
-- ---------------------------------------------------------------------
-- FK choice: incident_id -> incidents.id ON DELETE SET NULL.
--   Log entries are uploaded independently and only *optionally* linked to an
--   incident (the column is nullable by design). Raw log data has analysis
--   value on its own, so deleting an incident merely unlinks its logs rather
--   than cascading the delete and destroying evidence.
CREATE TABLE IF NOT EXISTS logs (
    id           BIGINT       NOT NULL AUTO_INCREMENT,
    incident_id  BIGINT       NULL,
    `timestamp`  DATETIME     NOT NULL,
    log_level    VARCHAR(10)  NOT NULL,             -- TRACE | DEBUG | INFO | WARN | ERROR | FATAL
    message      TEXT         NULL,
    source       VARCHAR(255) NULL,                 -- original uploaded filename
    uploaded_by  VARCHAR(255) NULL,                 -- uploader's email
    created_at   DATETIME     NOT NULL,
    PRIMARY KEY (id),
    KEY idx_logs_log_level (log_level),
    KEY idx_logs_timestamp (`timestamp`),
    KEY idx_logs_incident  (incident_id),
    CONSTRAINT fk_logs_incident
        FOREIGN KEY (incident_id) REFERENCES incidents (id)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 4) sla_rules  (com.ims.sla.SlaRule)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sla_rules (
    id                    BIGINT     NOT NULL AUTO_INCREMENT,
    priority              VARCHAR(5) NOT NULL,      -- P1 | P2 | P3 | P4
    resolution_time_hours INT        NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_sla_rules_priority (priority)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 5) escalations  (com.ims.escalation.Escalation)
-- ---------------------------------------------------------------------
-- FK choice: incident_id -> incidents.id ON DELETE CASCADE.
--   An escalation record is meaningless without its incident (it is pure
--   child data), so it is removed together with the incident.
CREATE TABLE IF NOT EXISTS escalations (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    incident_id   BIGINT       NOT NULL,
    level         INT          NOT NULL,            -- 1..3
    escalated_to  VARCHAR(50)  NOT NULL,            -- TEAM_LEAD | MANAGER | CRITICAL_ALERT
    reason        VARCHAR(255) NULL,
    escalated_at  DATETIME     NOT NULL,
    PRIMARY KEY (id),
    KEY idx_escalations_incident (incident_id),
    CONSTRAINT fk_escalations_incident
        FOREIGN KEY (incident_id) REFERENCES incidents (id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 6) audit_logs  (com.ims.audit.AuditLog)
-- ---------------------------------------------------------------------
-- Deliberately NO foreign key on entity_id: it is a polymorphic reference
-- (entity_type + entity_id can point at incidents, users, KB articles, ...).
-- Audit trails must also survive deletion of the audited entity - the
-- DELETED action itself is recorded here - so no CASCADE is wanted.
CREATE TABLE IF NOT EXISTS audit_logs (
    id           BIGINT        NOT NULL AUTO_INCREMENT,
    entity_type  VARCHAR(50)   NOT NULL,            -- e.g. "INCIDENT"
    entity_id    BIGINT        NOT NULL,
    action       VARCHAR(30)   NOT NULL,            -- AuditAction (EnumType.STRING)
    field_name   VARCHAR(100)  NULL,
    old_value    VARCHAR(1000) NULL,
    new_value    VARCHAR(1000) NULL,
    performed_by VARCHAR(255)  NOT NULL,            -- actor's email
    `timestamp`  DATETIME      NOT NULL,
    PRIMARY KEY (id),
    KEY idx_audit_entity (entity_type, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 7) kb_articles  (com.ims.kb.KnowledgeBaseArticle)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kb_articles (
    id                BIGINT       NOT NULL AUTO_INCREMENT,
    kb_number         VARCHAR(20)  NOT NULL,        -- e.g. "KB-101"
    title             VARCHAR(255) NOT NULL,
    issue_description TEXT         NULL,
    root_cause        TEXT         NULL,
    resolution        TEXT         NULL,
    keywords          VARCHAR(500) NULL,            -- comma-separated, lowercase
    created_by        VARCHAR(255) NULL,
    created_at        DATETIME     NOT NULL,
    times_used        INT          NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_kb_articles_number (kb_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
