package com.ims.user.dto;

import com.ims.common.enums.Role;

import jakarta.validation.constraints.NotNull;

public record UpdateRoleRequest(
        @NotNull(message = "role is required") Role role
) {
}
