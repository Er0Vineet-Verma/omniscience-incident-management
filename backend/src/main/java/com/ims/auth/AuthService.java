package com.ims.auth;

import java.time.LocalDateTime;

import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ims.audit.AuditService;
import com.ims.auth.dto.AuthResponse;
import com.ims.auth.dto.LoginRequest;
import com.ims.auth.dto.RegisterRequest;
import com.ims.common.enums.AuditAction;
import com.ims.common.enums.Role;
import com.ims.common.enums.UserStatus;
import com.ims.common.exception.BadRequestException;
import com.ims.user.User;
import com.ims.user.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final AuditService auditService;
    private final LoginAttemptService loginAttemptService;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            throw new BadRequestException("Email is already registered: " + request.email());
        }

        Role role = resolveRole(request.role());
        boolean adminCreating = isCurrentUserAdmin();
        if (role != Role.CUSTOMER && !adminCreating) {
            throw new BadRequestException("Only administrators can create users with role " + role.name());
        }

        User user = User.builder()
                .name(request.name())
                .email(request.email())
                .password(passwordEncoder.encode(request.password()))
                .role(role)
                .status(UserStatus.ACTIVE)
                .createdAt(LocalDateTime.now())
                .build();
        User saved = userRepository.save(user);

        String performedBy = adminCreating
                ? SecurityContextHolder.getContext().getAuthentication().getName()
                : saved.getEmail();
        auditService.record("USER", saved.getId(), AuditAction.CREATED, null, null,
                saved.getEmail() + " (" + saved.getRole().name() + ")", performedBy);

        String token = jwtService.generateToken(saved);
        return toAuthResponse(token, saved);
    }

    public AuthResponse login(LoginRequest request) {
        String email = request.email();
        if (loginAttemptService.isLocked(email)) {
            throw new LockedException("Account temporarily locked due to repeated failed logins. Try again in "
                    + loginAttemptService.secondsUntilUnlock(email) + " seconds.");
        }

        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(email, request.password()));
        } catch (AuthenticationException ex) {
            loginAttemptService.loginFailed(email);
            throw ex;
        }
        loginAttemptService.loginSucceeded(email);

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new BadRequestException("User not found with email: " + email));

        String token = jwtService.generateToken(user);
        return toAuthResponse(token, user);
    }

    private Role resolveRole(String requestedRole) {
        if (requestedRole == null || requestedRole.isBlank()) {
            return Role.CUSTOMER;
        }
        try {
            return Role.valueOf(requestedRole.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("Invalid role: " + requestedRole);
        }
    }

    private boolean isCurrentUserAdmin() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication != null
                && authentication.isAuthenticated()
                && authentication.getAuthorities().stream()
                        .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority()));
    }

    private AuthResponse toAuthResponse(String token, User user) {
        return new AuthResponse(token, "Bearer", user.getId(), user.getName(), user.getEmail(),
                user.getRole().name());
    }
}
