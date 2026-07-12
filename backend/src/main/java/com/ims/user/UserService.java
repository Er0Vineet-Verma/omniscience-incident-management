package com.ims.user;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ims.audit.AuditService;
import com.ims.common.enums.AuditAction;
import com.ims.common.enums.Role;
import com.ims.common.enums.UserStatus;
import com.ims.common.exception.NotFoundException;
import com.ims.user.dto.UserResponse;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class UserService {

    private static final String ENTITY_TYPE = "USER";

    private final UserRepository userRepository;
    private final AuditService auditService;

    @Transactional(readOnly = true)
    public List<UserResponse> listAll() {
        return userRepository.findAll().stream()
                .map(UserResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<UserResponse> listAnalysts() {
        return userRepository.findByRoleAndStatus(Role.ANALYST, UserStatus.ACTIVE).stream()
                .map(UserResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public UserResponse me(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new NotFoundException("User not found with email: " + email));
        return UserResponse.from(user);
    }

    @Transactional
    public UserResponse updateStatus(Long id, UserStatus status, String performedBy) {
        User user = findUser(id);
        UserStatus oldStatus = user.getStatus();
        user.setStatus(status);
        user = userRepository.save(user);

        auditService.record(ENTITY_TYPE, user.getId(), AuditAction.STATUS_CHANGED,
                "status",
                oldStatus == null ? null : oldStatus.name(),
                status.name(),
                performedBy);

        return UserResponse.from(user);
    }

    @Transactional
    public UserResponse updateRole(Long id, Role role, String performedBy) {
        User user = findUser(id);
        Role oldRole = user.getRole();
        user.setRole(role);
        user = userRepository.save(user);

        auditService.record(ENTITY_TYPE, user.getId(), AuditAction.UPDATED,
                "role",
                oldRole == null ? null : oldRole.name(),
                role.name(),
                performedBy);

        return UserResponse.from(user);
    }

    private User findUser(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("User not found with id: " + id));
    }
}
