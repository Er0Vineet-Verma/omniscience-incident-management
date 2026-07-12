package com.ims.assignment;

import java.util.Comparator;
import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ims.common.enums.Role;
import com.ims.common.enums.UserStatus;
import com.ims.incident.Incident;
import com.ims.incident.IncidentRepository;
import com.ims.user.User;
import com.ims.user.UserRepository;

import lombok.RequiredArgsConstructor;

/**
 * DB-driven round-robin assignment of incidents to active analysts.
 * The pointer is derived from the most recently assigned incident, so the
 * rotation survives restarts without any in-memory state.
 */
@Service
@RequiredArgsConstructor
public class AssignmentService {

    private final UserRepository userRepository;
    private final IncidentRepository incidentRepository;

    @Transactional(readOnly = true)
    public Optional<User> nextAnalyst() {
        List<User> analysts = userRepository.findByRoleAndStatus(Role.ANALYST, UserStatus.ACTIVE)
                .stream()
                .sorted(Comparator.comparing(User::getId))
                .toList();
        if (analysts.isEmpty()) {
            return Optional.empty();
        }

        Long lastAssignedAnalystId = incidentRepository.findTopByAssignedToIsNotNullOrderByIdDesc()
                .map(Incident::getAssignedTo)
                .map(User::getId)
                .orElse(null);

        if (lastAssignedAnalystId == null) {
            return Optional.of(analysts.get(0));
        }

        int lastIndex = -1;
        for (int i = 0; i < analysts.size(); i++) {
            if (analysts.get(i).getId().equals(lastAssignedAnalystId)) {
                lastIndex = i;
                break;
            }
        }
        // If the last assignee is no longer an active analyst, lastIndex stays -1
        // and we naturally start again from the first analyst in the ordered list.
        return Optional.of(analysts.get((lastIndex + 1) % analysts.size()));
    }
}
