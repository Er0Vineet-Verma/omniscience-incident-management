package com.ims.support;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Shared base for API tests: boots the full application context against the
 * in-memory test profile (see application-test.yml) and provides login helpers
 * for the users seeded by {@link com.ims.config.DataSeeder}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public abstract class ApiTestSupport {

    public static final String ADMIN_EMAIL = "admin@ims.com";
    public static final String ADMIN_PASSWORD = "Admin@123";
    public static final String ANALYST_EMAIL = "analyst1@ims.com";
    public static final String ANALYST_PASSWORD = "Analyst@123";
    public static final String CUSTOMER_EMAIL = "customer@ims.com";
    public static final String CUSTOMER_PASSWORD = "Customer@123";

    @Autowired
    protected MockMvc mockMvc;

    @Autowired
    protected ObjectMapper objectMapper;

    /** Logs in through the real /api/auth/login endpoint and returns the JWT. */
    protected String loginAndGetToken(String email, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        return body.get("token").asText();
    }

    protected String bearer(String token) {
        return "Bearer " + token;
    }
}
