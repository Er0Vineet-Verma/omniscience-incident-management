package com.ims.rca.dto;

import java.util.List;

import jakarta.validation.constraints.NotNull;

public record RcaAnalyzeRequest(
        @NotNull(message = "logs must not be null") List<String> logs
) {
}
