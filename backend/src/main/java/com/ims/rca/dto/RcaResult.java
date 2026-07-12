package com.ims.rca.dto;

import java.util.List;

public record RcaResult(
        Long incidentId,
        int analyzedLogCount,
        int errorCount,
        int warnCount,
        List<RcaFinding> findings,
        List<KbMatch> kbMatches
) {
}
