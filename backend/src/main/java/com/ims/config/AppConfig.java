package com.ims.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class AppConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        // Cost factor 12 (checklist minimum). BCrypt stores the cost in each hash,
        // so existing cost-10 hashes still verify; only new/changed passwords use 12.
        return new BCryptPasswordEncoder(12);
    }
}
