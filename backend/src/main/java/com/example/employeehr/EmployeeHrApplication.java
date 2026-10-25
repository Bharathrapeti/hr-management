package com.example.employeehr;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.util.Properties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class EmployeeHrApplication {
    public static void main(String[] args) {
        loadLocalEnvIfPresent();
        SpringApplication.run(EmployeeHrApplication.class, args);
    }

    static void loadLocalEnvIfPresent() {
        File[] candidateFiles = new File[] {
            new File(".env"),
            new File("backend/.env"),
            new File("../backend/.env")
        };
        for (File envFile : candidateFiles) {
            if (envFile.exists() && envFile.isFile()) {
                try (InputStream in = new FileInputStream(envFile)) {
                    Properties props = new Properties();
                    props.load(in);
                    for (String name : props.stringPropertyNames()) {
                        if (System.getenv(name) == null && System.getProperty(name) == null) {
                            String value = props.getProperty(name);
                            if (value != null) {
                                System.setProperty(name, value.trim());
                            }
                        }
                    }
                    break;
                } catch (Exception ignored) {
                }
            }
        }
    }
}
