package com.ims.dashboard.dto;

/** Server-side SLA health buckets computed over ALL active incidents (scales past page limits). */
public record SlaBuckets(long healthy, long risk, long fail) {
}
