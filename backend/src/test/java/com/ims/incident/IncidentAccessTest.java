package com.ims.incident;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import com.fasterxml.jackson.databind.JsonNode;
import com.ims.support.ApiTestSupport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Customer data isolation: a customer can create and read their own requests,
 * but can never read another user's incident, and their list view only ever
 * contains their own records.
 */
class IncidentAccessTest extends ApiTestSupport {

    private long createIncident(String token, String title) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/incidents")
                        .header(HttpHeaders.AUTHORIZATION, bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"" + title + "\",\"description\":\"isolation test\",\"priority\":\"P4\"}"))
                .andExpect(status().isCreated())
                .andReturn();
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        return body.get("id").asLong();
    }

    @Test
    void customerCanCreateAndReadOwnIncident() throws Exception {
        String customerToken = loginAndGetToken(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
        long id = createIncident(customerToken, "Own request readable");

        mockMvc.perform(get("/api/incidents/" + id).header(HttpHeaders.AUTHORIZATION, bearer(customerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Own request readable"));

        mockMvc.perform(get("/api/incidents/my-summary").header(HttpHeaders.AUTHORIZATION, bearer(customerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").isNumber());
    }

    @Test
    void customerCannotReadAnotherUsersIncident() throws Exception {
        String adminToken = loginAndGetToken(ADMIN_EMAIL, ADMIN_PASSWORD);
        long adminIncidentId = createIncident(adminToken, "Admin-owned incident");

        String customerToken = loginAndGetToken(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
        mockMvc.perform(get("/api/incidents/" + adminIncidentId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(customerToken)))
                .andExpect(status().isForbidden());
    }

    @Test
    void customerListContainsOnlyOwnIncidents() throws Exception {
        String adminToken = loginAndGetToken(ADMIN_EMAIL, ADMIN_PASSWORD);
        createIncident(adminToken, "Not visible to customers");

        String customerToken = loginAndGetToken(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
        MvcResult result = mockMvc.perform(get("/api/incidents?size=100")
                        .header(HttpHeaders.AUTHORIZATION, bearer(customerToken)))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode page = objectMapper.readTree(result.getResponse().getContentAsString());
        for (JsonNode incident : page.get("content")) {
            assertThat(incident.get("createdByName").asText())
                    .as("customer list must only contain the customer's own incidents")
                    .isEqualTo("Demo Customer");
        }
    }
}
