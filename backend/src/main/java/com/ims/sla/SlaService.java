package com.ims.sla;

import java.util.List;

import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ims.audit.AuditService;
import com.ims.common.enums.AuditAction;
import com.ims.common.exception.NotFoundException;
import com.ims.sla.dto.SlaRuleRequest;
import com.ims.sla.dto.SlaRuleResponse;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class SlaService {

    private static final String ENTITY_TYPE = "SLA_RULE";

    private final SlaRuleRepository slaRuleRepository;
    private final AuditService auditService;

    @Transactional(readOnly = true)
    public List<SlaRuleResponse> listRules() {
        return slaRuleRepository.findAll(Sort.by("priority")).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public SlaRuleResponse updateRule(Long id, SlaRuleRequest request, String performedBy) {
        SlaRule rule = slaRuleRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("SLA rule not found with id: " + id));

        int oldHours = rule.getResolutionTimeHours();
        rule.setResolutionTimeHours(request.resolutionTimeHours());
        SlaRule saved = slaRuleRepository.save(rule);

        auditService.record(ENTITY_TYPE, saved.getId(), AuditAction.UPDATED, "resolutionTimeHours",
                String.valueOf(oldHours), String.valueOf(saved.getResolutionTimeHours()), performedBy);

        return toResponse(saved);
    }

    private SlaRuleResponse toResponse(SlaRule rule) {
        return new SlaRuleResponse(rule.getId(), rule.getPriority(), rule.getResolutionTimeHours());
    }
}
