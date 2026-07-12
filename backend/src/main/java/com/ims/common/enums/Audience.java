package com.ims.common.enums;

/**
 * Who a knowledge-base article is written for. Customer Help Center shows only
 * CUSTOMER + BOTH; the internal KB shows everything. Existing/legacy articles
 * with a null audience are treated as INTERNAL.
 */
public enum Audience {
    INTERNAL,
    CUSTOMER,
    BOTH
}
