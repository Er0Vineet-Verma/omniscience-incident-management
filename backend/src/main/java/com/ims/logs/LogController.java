package com.ims.logs;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.ims.common.enums.LogLevel;
import com.ims.logs.dto.LogResponse;
import com.ims.logs.dto.LogUploadResult;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/logs")
@RequiredArgsConstructor
public class LogController {

    private final LogService logService;

    @PostMapping("/upload")
    @PreAuthorize("hasAnyRole('ANALYST', 'ADMIN')")
    public ResponseEntity<LogUploadResult> upload(@RequestParam("file") MultipartFile file,
                                                  @RequestParam(value = "incidentId", required = false) Long incidentId,
                                                  Authentication authentication) {
        return ResponseEntity.ok(logService.upload(file, incidentId, authentication.getName()));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ANALYST', 'ADMIN')")
    public ResponseEntity<Page<LogResponse>> search(
            @RequestParam(required = false) LogLevel level,
            @RequestParam(required = false) Long incidentId,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to,
            @PageableDefault(size = 20, sort = "timestamp", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(logService.search(level, incidentId, q, from, to, pageable));
    }

    @GetMapping("/incident/{incidentId}")
    public ResponseEntity<List<LogResponse>> byIncident(@PathVariable Long incidentId) {
        return ResponseEntity.ok(logService.findByIncident(incidentId));
    }

    @GetMapping("/stats")
    @PreAuthorize("hasAnyRole('ANALYST', 'ADMIN')")
    public ResponseEntity<Map<String, Long>> stats() {
        return ResponseEntity.ok(logService.stats());
    }
}
