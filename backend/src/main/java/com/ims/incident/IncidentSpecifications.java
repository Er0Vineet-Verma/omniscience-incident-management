package com.ims.incident;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import org.springframework.data.jpa.domain.Specification;

import com.ims.common.enums.IncidentStatus;
import com.ims.common.enums.Priority;

import jakarta.persistence.criteria.Predicate;

public final class IncidentSpecifications {

    private IncidentSpecifications() {
    }

    public static Specification<Incident> hasPriority(Priority priority) {
        return (root, query, cb) -> cb.equal(root.get("priority"), priority);
    }

    public static Specification<Incident> hasStatus(IncidentStatus status) {
        return (root, query, cb) -> cb.equal(root.get("status"), status);
    }

    public static Specification<Incident> assignedToId(Long analystId) {
        return (root, query, cb) -> cb.equal(root.get("assignedTo").get("id"), analystId);
    }

    public static Specification<Incident> createdByEmail(String email) {
        return (root, query, cb) -> cb.equal(cb.lower(root.get("createdBy").get("email")),
                email.toLowerCase(Locale.ROOT));
    }

    /**
     * Free-text search: incidentNumber/title/description containing the term
     * (case-insensitive), OR the term exactly matching a Priority/IncidentStatus
     * enum name (case-insensitive).
     */
    public static Specification<Incident> matchesQuery(String q) {
        return (root, query, cb) -> {
            String like = "%" + q.trim().toLowerCase(Locale.ROOT) + "%";
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.like(cb.lower(root.get("incidentNumber")), like));
            predicates.add(cb.like(cb.lower(root.get("title")), like));
            predicates.add(cb.like(cb.lower(root.get("description")), like));

            String token = q.trim().toUpperCase(Locale.ROOT);
            for (Priority priority : Priority.values()) {
                if (priority.name().equals(token)) {
                    predicates.add(cb.equal(root.get("priority"), priority));
                }
            }
            for (IncidentStatus status : IncidentStatus.values()) {
                if (status.name().equals(token)) {
                    predicates.add(cb.equal(root.get("status"), status));
                }
            }
            return cb.or(predicates.toArray(new Predicate[0]));
        };
    }
}
