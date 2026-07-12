package com.ims.incident.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CommentRequest(
        @NotBlank(message = "Comment body is required")
        @Size(max = 4000, message = "Comment must be at most 4000 characters")
        String body
) {
}
