package com.ims.csat;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface CsatRepository extends JpaRepository<CsatRating, Long> {

    Optional<CsatRating> findByIncidentId(Long incidentId);
}
