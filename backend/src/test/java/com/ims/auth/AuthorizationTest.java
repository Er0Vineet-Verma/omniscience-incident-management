package com.ims.auth;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;

import com.ims.support.ApiTestSupport;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Role boundaries: global aggregates and the internal KB catalog are for
 * ANALYST/ADMIN only; customers keep their filtered endpoints; anonymous
 * callers are rejected outright.
 */
class AuthorizationTest extends ApiTestSupport {

    @Test
    void anonymousRequestsAreRejected() throws Exception {
        mockMvc.perform(get("/api/incidents")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/dashboard/summary")).andExpect(status().isUnauthorized());
    }

    @Test
    void customerCannotAccessGlobalDashboard() throws Exception {
        String token = loginAndGetToken(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
        mockMvc.perform(get("/api/dashboard/summary").header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isForbidden());
    }

    @Test
    void adminCanAccessGlobalDashboard() throws Exception {
        String token = loginAndGetToken(ADMIN_EMAIL, ADMIN_PASSWORD);
        mockMvc.perform(get("/api/dashboard/summary").header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk());
    }

    @Test
    void analystCanAccessReports() throws Exception {
        String token = loginAndGetToken(ANALYST_EMAIL, ANALYST_PASSWORD);
        mockMvc.perform(get("/api/reports/sla-compliance").header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk());
    }

    @Test
    void customerCannotListInternalKbCatalog() throws Exception {
        String token = loginAndGetToken(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
        mockMvc.perform(get("/api/kb").header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isForbidden());
    }

    @Test
    void customerCanReadHelpCenterFeed() throws Exception {
        String token = loginAndGetToken(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
        mockMvc.perform(get("/api/kb/help").header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk());
    }

    @Test
    void customerCannotAccessAdminUserManagement() throws Exception {
        String token = loginAndGetToken(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
        mockMvc.perform(get("/api/users").header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isForbidden());
    }
}
