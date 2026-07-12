package com.ims.sla;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.ims.common.enums.Priority;

public interface SlaRuleRepository extends JpaRepository<SlaRule, Long> {

    Optional<SlaRule> findByPriority(Priority priority);
}
