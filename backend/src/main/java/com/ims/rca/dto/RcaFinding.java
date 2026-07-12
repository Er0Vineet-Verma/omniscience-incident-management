package com.ims.rca.dto;

import java.util.List;

public record RcaFinding(
        String rule,
        int matchCount,
        String likelyRootCause,
        List<String> suggestedActions
) {
}
