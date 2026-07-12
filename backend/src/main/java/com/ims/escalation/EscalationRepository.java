package com.ims.escalation;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface EscalationRepository extends JpaRepository<Escalation, Long> {

    List<Escalation> findByIncidentIdOrderByEscalatedAtDesc(Long incidentId);

    List<Escalation> findAllByOrderByEscalatedAtDesc();
}
