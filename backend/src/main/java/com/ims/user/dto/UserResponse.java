package com.ims.user.dto;

import java.time.LocalDateTime;

import com.ims.common.enums.Role;
import com.ims.common.enums.UserStatus;
import com.ims.user.User;

public record UserResponse(
        Long id,
        String name,
        String email,
        Role role,
        UserStatus status,
        LocalDateTime createdAt
) {
    public static UserResponse from(User user) {
        return new UserResponse(
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.getRole(),
                user.getStatus(),
                user.getCreatedAt()
        );
    }
}
