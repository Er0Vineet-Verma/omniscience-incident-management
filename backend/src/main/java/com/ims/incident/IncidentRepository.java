package com.ims.incident;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import com.ims.common.enums.IncidentStatus;
import com.ims.common.enums.Priority;
import com.ims.user.User;

public interface IncidentRepository extends JpaRepository<Incident, Long>, JpaSpecificationExecutor<Incident> {

    Optional<Incident> findByIncidentNumber(String incidentNumber);

    long countByStatus(IncidentStatus status);

    long countByStatusNotIn(Collection<IncidentStatus> statuses);

    long countByPriorityAndStatusNotIn(Priority priority, Collection<IncidentStatus> statuses);

    long countByStatusAndClosedAtBetween(IncidentStatus status, LocalDateTime from, LocalDateTime to);

    long countBySlaBreachedTrueAndStatusNotIn(Collection<IncidentStatus> statuses);

    List<Incident> findByStatusNotInAndSlaDeadlineBefore(Collection<IncidentStatus> statuses, LocalDateTime deadline);

    Optional<Incident> findTopByAssignedToIsNotNullOrderByIdDesc();

    Optional<Incident> findTopByOrderByIdDesc();

    List<Incident> findByCreatedAtBetween(LocalDateTime from, LocalDateTime to);

    List<Incident> findByStatusNotIn(Collection<IncidentStatus> statuses);

    List<Incident> findByAssignedTo(User assignedTo);

    long countByAssignedTo(User assignedTo);

    long countByAssignedToAndStatusIn(User assignedTo, Collection<IncidentStatus> statuses);

    List<Incident> findByResolvedAtIsNotNull();

    long countByPriority(Priority priority);
}
