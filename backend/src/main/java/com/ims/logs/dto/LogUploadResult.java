package com.ims.logs.dto;

public record LogUploadResult(
        String source,
        int totalLines,
        int parsed,
        int errors,
        int warnings,
        int infos,
        Long incidentId
) {
}
