package com.example.employeehr;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.InputStream;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.yaml.snakeyaml.Yaml;

class ApplicationYamlTest {
    @Test
    @SuppressWarnings("unchecked")
    void applicationYamlContainsValidMailTimeouts() {
        Yaml yaml = new Yaml();
        try (InputStream in = getClass().getResourceAsStream("/application.yml")) {
            assertThat(in).isNotNull();
            Map<String, Object> data = yaml.load(in);
            Map<String, Object> spring = (Map<String, Object>) data.get("spring");
            Map<String, Object> mail = (Map<String, Object>) spring.get("mail");
            Map<String, Object> properties = (Map<String, Object>) mail.get("properties");

            assertThat(properties.get("mail.smtp.auth")).isEqualTo(true);
            assertThat(properties.get("mail.smtp.starttls.enable")).isEqualTo(true);
            assertThat(properties.get("mail.smtp.connectiontimeout")).isEqualTo(5000);
            assertThat(properties.get("mail.smtp.timeout")).isEqualTo(5000);
            assertThat(properties.get("mail.smtp.writetimeout")).isEqualTo(5000);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
