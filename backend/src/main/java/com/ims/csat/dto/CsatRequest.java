package com.ims.csat.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

public record CsatRequest(
        @Min(value = 1, message = "rating must be 1-5") @Max(value = 5, message = "rating must be 1-5") int rating,
        String comment
) {
}
