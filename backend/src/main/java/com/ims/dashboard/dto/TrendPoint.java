package com.ims.dashboard.dto;

public record TrendPoint(
        String date,
        long created,
        long resolved
) {
}
