package com.example.employeehr.auth.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.employeehr.config.AuthProperties;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import java.time.Duration;
import java.util.Properties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

class EmailServiceTest {
    private JavaMailSender mailSender;
    private AuthProperties properties;
    private EmailService emailService;

    @BeforeEach
    void setUp() {
        mailSender = mock(JavaMailSender.class);
        properties = new AuthProperties(
                Duration.ofHours(8),
                Duration.ofMinutes(10),
                5,
                60,
                5,
                "noreply@example.com",
                false,
                false,
                null,
                null,
                null);
        emailService = new EmailService(mailSender, properties);
    }

    @Test
    void sendOtpSendsMimeMessageWithHtmlAndPlainTextForSignup() throws Exception {
        Session session = Session.getInstance(new Properties());
        MimeMessage mimeMessage = new MimeMessage(session);
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

        emailService.sendOtp("user@example.com", "Jane Doe", "SIGNUP", "123456");

        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender).send(captor.capture());

        MimeMessage sent = captor.getValue();
        assertThat(sent.getSubject()).isEqualTo("Verify your email address | Employee HR Management System");
        assertThat(sent.getAllRecipients()[0].toString()).isEqualTo("user@example.com");
        assertThat(sent.getFrom()[0].toString()).contains("Employee HR Management System");
    }

    @Test
    void sendOtpUsesPasswordResetSubjectAndMessage() throws Exception {
        Session session = Session.getInstance(new Properties());
        MimeMessage mimeMessage = new MimeMessage(session);
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

        emailService.sendOtp("user@example.com", "Jane Doe", "PASSWORD_RESET", "654321");

        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender).send(captor.capture());

        MimeMessage sent = captor.getValue();
        assertThat(sent.getSubject()).isEqualTo("Reset your password | Employee HR Management System");
    }

    @Test
    void sendOtpFallsBackToSimpleMessageWhenMimeNotAvailable() {
        when(mailSender.createMimeMessage()).thenReturn(null);

        emailService.sendOtp("user@example.com", "Jane Doe", "SIGNUP", "123456");

        ArgumentCaptor<SimpleMailMessage> captor = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(mailSender).send(captor.capture());

        SimpleMailMessage sent = captor.getValue();
        assertThat(sent.getSubject()).isEqualTo("Verify your email address | Employee HR Management System");
        assertThat(sent.getText()).contains("123456");
        assertThat(sent.getText()).contains("Jane Doe");
    }
}
