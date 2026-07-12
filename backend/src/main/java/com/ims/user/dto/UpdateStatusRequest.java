package com.ims.user.dto;

import com.ims.common.enums.UserStatus;

import jakarta.validation.constraints.NotNull;

public record UpdateStatusRequest(
        @NotNull(message = "status is required") UserStatus status
) {
}
