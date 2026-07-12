package com.ims.incident;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

import com.ims.common.enums.Role;
import com.ims.common.exception.NotFoundException;
import com.ims.user.User;
import com.ims.user.UserRepository;

import lombok.RequiredArgsConstructor;

/**
 * Shared visibility check reused by the customer-facing subsystems (attachments, CSAT):
 * customers may only touch their own requests; analysts/admins are unrestricted.
 */
@Component
@RequiredArgsConstructor
public class IncidentAccessGuard {

    private final IncidentRepository incidentRepository;
    private final UserRepository userRepository;

    public Incident requireVisible(Long incidentId, String email) {
        Incident incident = incidentRepository.findById(incidentId)
                .orElseThrow(() -> new NotFoundException("Incident not found with id: " + incidentId));
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new NotFoundException("User not found: " + email));
        if (user.getRole() == Role.CUSTOMER) {
            User createdBy = incident.getCreatedBy();
            if (createdBy == null || !email.equalsIgnoreCase(createdBy.getEmail())) {
                throw new AccessDeniedException("Customers may only access their own requests");
            }
        }
        return incident;
    }
}
