# Database Scripts

MySQL 8 scripts for the Incident Management & Log Analysis System backend.

| File | Purpose |
|------|---------|
| `schema.sql` | DDL for all seven tables (`users`, `incidents`, `logs`, `sla_rules`, `escalations`, `audit_logs`, `kb_articles`), matching the JPA entities in `com.ims.*` exactly: keys, foreign keys, and indexes. Idempotent (`CREATE TABLE IF NOT EXISTS`). |
| `seed.sql` | Reference data: SLA rules (P1=4h, P2=8h, P3=24h, P4=72h) and three sample knowledge base articles. Idempotent (`INSERT IGNORE`). |

> **Important:** the Spring Boot application runs with `spring.jpa.hibernate.ddl-auto=update`, so Hibernate creates/updates the schema automatically on startup. These scripts are **reference / manual-setup material** — useful for standing up the database without the app, for review, or for fresh environments where you want the schema in place before first boot.

> **Users are not seeded here.** Application accounts (admin/analyst/customer) are created by the Spring `DataSeeder` at startup, because passwords must be bcrypt hashes produced by the application's `PasswordEncoder` — not plain SQL.

## Applying the scripts

### Option 1 — docker-compose (automatic)

When MySQL runs via the project `docker-compose.yml`, the database is created automatically (and the app's `ddl-auto=update` builds the tables on first boot). To have MySQL itself run these scripts on first container start, mount them into the init directory:

```yaml
services:
  mysql:
    image: mysql:8
    environment:
      MYSQL_DATABASE: imsdb        # matches DB_NAME default in application-mysql.yml
      MYSQL_USER: ims
      MYSQL_PASSWORD: ims_password
    volumes:
      - ./database/schema.sql:/docker-entrypoint-initdb.d/01-schema.sql
      - ./database/seed.sql:/docker-entrypoint-initdb.d/02-seed.sql
```

Files in `/docker-entrypoint-initdb.d/` run in alphabetical order, only when the data volume is empty (first start).

### Option 2 — manual (mysql CLI)

```bash
mysql -u root -p < schema.sql
mysql -u root -p < seed.sql
```

Both scripts contain `USE imsdb;` (and `schema.sql` creates the database if missing), so no `-D` flag is needed. Run them in order: schema first, then seed. The database name `imsdb` matches the backend default (`${DB_NAME:imsdb}` in `application-mysql.yml`, user `ims`).

### Option 3 — let the app do it

Just start the Spring Boot backend against an empty `imsdb` database; `ddl-auto=update` creates the tables and the `DataSeeder` inserts users and baseline data. You can still run `seed.sql` afterwards — `INSERT IGNORE` skips anything already present.

## Design notes (FKs and indexes)

- `incidents.assigned_to → users.id` is `ON DELETE SET NULL`: deleting an analyst unassigns their incidents instead of destroying history.
- `incidents.created_by → users.id` is `ON DELETE RESTRICT`: incidents must keep their creator for accountability (the app deactivates users rather than deleting them).
- `logs.incident_id → incidents.id` is `ON DELETE SET NULL`: log entries are uploaded independently and only optionally linked to an incident; deleting an incident unlinks its logs rather than destroying evidence.
- `escalations.incident_id → incidents.id` is `ON DELETE CASCADE`: escalation records are pure child data with no meaning outside their incident.
- `audit_logs` has **no** FK on `entity_id`: it is a polymorphic reference (`entity_type` + `entity_id`), and audit records must survive deletion of the audited entity.
- Indexes: `incidents(status)`, `incidents(priority)`, `incidents(sla_deadline)`, `logs(log_level)`, `logs(timestamp)`, `logs(incident_id)`, `escalations(incident_id)`, `audit_logs(entity_type, entity_id)`, plus unique keys on `users.email`, `incidents.incident_number`, `sla_rules.priority`, `kb_articles.kb_number`.
