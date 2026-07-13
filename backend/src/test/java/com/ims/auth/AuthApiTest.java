package com.ims.auth;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import com.ims.support.ApiTestSupport;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Authentication flow: login, credential rejection, and self-registration rules. */
class AuthApiTest extends ApiTestSupport {

    @Test
    void loginSucceedsForSeededAdmin() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + ADMIN_EMAIL + "\",\"password\":\"" + ADMIN_PASSWORD + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.role").value("ADMIN"))
                .andExpect(jsonPath("$.email").value(ADMIN_EMAIL));
    }

    @Test
    void loginFailsWithWrongPassword() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + ADMIN_EMAIL + "\",\"password\":\"definitely-wrong\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void loginRejectsMalformedPayload() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"not-an-email\",\"password\":\"\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void selfRegistrationCreatesCustomerAccount() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Reg Test\",\"email\":\"reg-test-customer@example.com\","
                                + "\"password\":\"RegTest@123\",\"role\":\"CUSTOMER\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.role").value("CUSTOMER"))
                .andExpect(jsonPath("$.token").isNotEmpty());
    }

    @Test
    void anonymousCannotRegisterPrivilegedRoles() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Sneaky\",\"email\":\"sneaky-analyst@example.com\","
                                + "\"password\":\"Sneaky@123\",\"role\":\"ANALYST\"}"))
                .andExpect(status().isBadRequest());
    }
}
