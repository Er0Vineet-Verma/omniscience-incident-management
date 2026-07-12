package com.ims.kb.dto;

import com.ims.common.enums.Audience;

import jakarta.validation.constraints.NotBlank;

public record KbRequest(
        @NotBlank(message = "title is required") String title,
        String issueDescription,
        String rootCause,
        @NotBlank(message = "resolution is required") String resolution,
        String keywords,
        Audience audience
) {
}
