package com.example.employeehr.auth.service;

import com.example.employeehr.config.AuthProperties;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import java.nio.charset.StandardCharsets;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
public class EmailService {
    private static final String SENDER_NAME = "Employee HR Management System";
    private final JavaMailSender mailSender;
    private final AuthProperties properties;

    public EmailService(JavaMailSender mailSender, AuthProperties properties) {
        this.mailSender = mailSender;
        this.properties = properties;
    }

    public void sendOtp(String recipient, String recipientName, String purpose, String otp) {
        if (properties.mailFrom() == null || properties.mailFrom().isBlank()) {
            throw new IllegalStateException("SMTP email sender is not configured");
        }

        String displayName = (recipientName != null && !recipientName.isBlank()) ? recipientName.trim() : "there";
        boolean isPasswordReset = "PASSWORD_RESET".equalsIgnoreCase(purpose);
        String subject = isPasswordReset
                ? "Reset your password | Employee HR Management System"
                : "Verify your email address | Employee HR Management System";

        long expiryMinutes = properties.otpTtl() != null ? properties.otpTtl().toMinutes() : 10;
        String textContent = buildPlainTextContent(displayName, isPasswordReset, otp, expiryMinutes);
        String htmlContent = buildHtmlContent(displayName, isPasswordReset, otp, expiryMinutes);

        try {
            MimeMessage message = mailSender.createMimeMessage();
            if (message != null) {
                MimeMessageHelper helper = new MimeMessageHelper(message, true, StandardCharsets.UTF_8.name());
                helper.setFrom(new InternetAddress(properties.mailFrom(), SENDER_NAME, StandardCharsets.UTF_8.name()));
                helper.setReplyTo(new InternetAddress(properties.mailFrom(), SENDER_NAME, StandardCharsets.UTF_8.name()));
                helper.setTo(recipient);
                helper.setSubject(subject);
                helper.setText(textContent, htmlContent);

                message.setHeader("X-Priority", "1");
                message.setHeader("Importance", "high");
                message.setHeader("Auto-Submitted", "auto-generated");

                mailSender.send(message);
                return;
            }
        } catch (Exception e) {
            // Fallback to SimpleMailMessage if MimeMessage creation or dispatch is not supported
            sendSimpleFallback(recipient, subject, textContent);
            return;
        }

        sendSimpleFallback(recipient, subject, textContent);
    }

    public void sendOtp(String recipient, String purpose, String otp) {
        sendOtp(recipient, null, purpose, otp);
    }

    public void sendApprovalNotification(String recipient, String recipientName) {
        if (properties.mailFrom() == null || properties.mailFrom().isBlank()) {
            return;
        }
        String displayName = (recipientName != null && !recipientName.isBlank()) ? recipientName.trim() : "Employee";
        String subject = "Account Approved | Employee HR Management System";
        String textContent = "Employee HR Management System\n\n" +
                "Hello " + displayName + ",\n\n" +
                "Your employee account registration has been approved by an HR administrator.\n\n" +
                "You can now sign in to the Employee HR Management System using your registered email and password.\n\n" +
                "Regards,\n" +
                "Employee HR Management System\n" +
                "HR Operations Team\n";
        String htmlContent = buildStatusHtml(displayName,
                "Your employee account registration has been approved by an HR administrator.",
                "You can now sign in to the Employee HR Management System using your registered email and password.",
                true);
        sendSafeNotification(recipient, subject, textContent, htmlContent);
    }

    public void sendRejectionNotification(String recipient, String recipientName, String reason) {
        if (properties.mailFrom() == null || properties.mailFrom().isBlank()) {
            return;
        }
        String displayName = (recipientName != null && !recipientName.isBlank()) ? recipientName.trim() : "Applicant";
        String subject = "Registration Status Update | Employee HR Management System";
        String detailText = (reason != null && !reason.isBlank())
                ? "HR review note: " + reason.trim()
                : "Please contact the HR department if you have questions regarding this decision.";
        String textContent = "Employee HR Management System\n\n" +
                "Hello " + displayName + ",\n\n" +
                "We regret to inform you that your registration request for the Employee HR Management System was not approved.\n\n" +
                detailText + "\n\n" +
                "Regards,\n" +
                "Employee HR Management System\n" +
                "HR Operations Team\n";
        String htmlContent = buildStatusHtml(displayName,
                "We regret to inform you that your registration request for the Employee HR Management System was not approved.",
                detailText,
                false);
        sendSafeNotification(recipient, subject, textContent, htmlContent);
    }

    public void sendManagerAssignmentNotification(String recipient, String recipientName, String employeeName, String employeeEmail) {
        if (properties.mailFrom() == null || properties.mailFrom().isBlank()) {
            return;
        }
        String displayName = (recipientName != null && !recipientName.isBlank()) ? recipientName.trim() : "Manager";
        String targetName = (employeeName != null && !employeeName.isBlank()) ? employeeName.trim() : "New Employee";
        String subject = "New Employee Registration Assigned | Employee HR Management System";
        String textContent = "Employee HR Management System\n\n" +
                "Hello " + displayName + ",\n\n" +
                "A new employee registration for " + targetName + " (" + employeeEmail + ") has been assigned to you for review.\n\n" +
                "Please sign in to your manager dashboard to review and approve or reject this registration.\n\n" +
                "Regards,\n" +
                "Employee HR Management System\n" +
                "HR Operations Team\n";
        String htmlContent = buildStatusHtml(displayName,
                "A new employee registration for " + escapeHtml(targetName) + " (" + escapeHtml(employeeEmail) + ") has been assigned to you for review.",
                "Please sign in to your manager dashboard to review and decide on this registration.",
                true);
        sendSafeNotification(recipient, subject, textContent, htmlContent);
    }

    private void sendSafeNotification(String recipient, String subject, String textContent, String htmlContent) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            if (message != null) {
                MimeMessageHelper helper = new MimeMessageHelper(message, true, StandardCharsets.UTF_8.name());
                helper.setFrom(new InternetAddress(properties.mailFrom(), SENDER_NAME, StandardCharsets.UTF_8.name()));
                helper.setReplyTo(new InternetAddress(properties.mailFrom(), SENDER_NAME, StandardCharsets.UTF_8.name()));
                helper.setTo(recipient);
                helper.setSubject(subject);
                helper.setText(textContent, htmlContent);
                mailSender.send(message);
                return;
            }
        } catch (Exception e) {
            try {
                sendSimpleFallback(recipient, subject, textContent);
            } catch (Exception ignored) {
                // Safe: Never allow email failure to disrupt transaction
            }
        }
    }

    private String buildStatusHtml(String displayName, String mainMessage, String secondaryMessage, boolean isApproved) {
        String safeName = escapeHtml(displayName);
        String headerBadge = isApproved ? "Registration Approved" : "Registration Notice";
        String badgeColor = isApproved ? "#15803d" : "#b91c1c";
        String badgeBg = isApproved ? "#dcfce7" : "#fee2e2";
        return "<!DOCTYPE html>\n" +
                "<html lang=\"en\">\n" +
                "<head>\n" +
                "  <meta charset=\"UTF-8\">\n" +
                "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n" +
                "  <title>Employee HR Management System</title>\n" +
                "</head>\n" +
                "<body style=\"margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;\">\n" +
                "  <table role=\"presentation\" border=\"0\" cellpadding=\"0\" cellspacing=\"0\" width=\"100%\" style=\"background-color: #f8fafc; padding: 32px 16px;\">\n" +
                "    <tr>\n" +
                "      <td align=\"center\">\n" +
                "        <table role=\"presentation\" border=\"0\" cellpadding=\"0\" cellspacing=\"0\" width=\"100%\" style=\"max-width: 580px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden;\">\n" +
                "          <tr>\n" +
                "            <td style=\"background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 24px 32px; text-align: left;\">\n" +
                "              <div style=\"font-size: 18px; font-weight: 700; color: #ffffff;\">Employee HR Management System</div>\n" +
                "              <div style=\"font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 4px;\">Account Status Update</div>\n" +
                "            </td>\n" +
                "          </tr>\n" +
                "          <tr>\n" +
                "            <td style=\"padding: 32px 32px 24px;\">\n" +
                "              <div style=\"display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; color: " + badgeColor + "; background-color: " + badgeBg + "; margin-bottom: 16px;\">" + headerBadge + "</div>\n" +
                "              <h2 style=\"margin: 0 0 16px; font-size: 18px; font-weight: 600; color: #0f172a;\">Hello " + safeName + ",</h2>\n" +
                "              <p style=\"margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #334155;\">" + escapeHtml(mainMessage) + "</p>\n" +
                "              <p style=\"margin: 0 0 24px; font-size: 14px; line-height: 1.6; color: #475569;\">" + escapeHtml(secondaryMessage) + "</p>\n" +
                "              <div style=\"border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 28px; font-size: 13px; color: #64748b; line-height: 1.5;\">\n" +
                "                <p style=\"margin: 0 0 4px;\">Regards,</p>\n" +
                "                <p style=\"margin: 0; font-weight: 600; color: #0f172a;\">Employee HR Management System</p>\n" +
                "                <p style=\"margin: 0; font-size: 12px; color: #94a3b8;\">HR Operations Team</p>\n" +
                "              </div>\n" +
                "            </td>\n" +
                "          </tr>\n" +
                "        </table>\n" +
                "      </td>\n" +
                "    </tr>\n" +
                "  </table>\n" +
                "</body>\n" +
                "</html>";
    }

    private void sendSimpleFallback(String recipient, String subject, String textContent) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(properties.mailFrom());
        message.setTo(recipient);
        message.setSubject(subject);
        message.setText(textContent);
        mailSender.send(message);
    }

    private String buildPlainTextContent(String displayName, boolean isPasswordReset, String otp, long expiryMinutes) {
        String actionText = isPasswordReset
                ? "We received a request to reset your password for your Employee HR Management System account.\n\nTo choose a new password, enter the verification code below:"
                : "Welcome to the Employee HR Management System!\n\nTo complete your account registration, enter the verification code below:";

        String ignoreText = isPasswordReset
                ? "If you did not request a password reset, you can safely ignore this email."
                : "If you did not request this verification code, you can safely ignore this email.";

        return "Employee HR Management System\n\n" +
                "Hello " + displayName + ",\n\n" +
                actionText + "\n\n" +
                otp + "\n\n" +
                "This verification code expires in " + expiryMinutes + " minutes. For your security, do not share this code with anyone.\n\n" +
                ignoreText + "\n\n" +
                "If you cannot find this message in your Inbox, please check your Spam or Junk folder.\n\n" +
                "Regards,\n" +
                "Employee HR Management System\n" +
                "Account Security Team\n";
    }

    private String buildHtmlContent(String displayName, boolean isPasswordReset, String otp, long expiryMinutes) {
        String safeName = escapeHtml(displayName);
        String actionMessage = isPasswordReset
                ? "We received a request to reset your password for your Employee HR Management System account. To choose a new password, enter the verification code below."
                : "Welcome to the Employee HR Management System! To complete your account registration, enter the verification code below.";
        String ignoreText = isPasswordReset
                ? "If you did not request a password reset, you can safely ignore this email."
                : "If you did not request this verification code, you can safely ignore this email.";

        return "<!DOCTYPE html>\n" +
                "<html lang=\"en\">\n" +
                "<head>\n" +
                "  <meta charset=\"UTF-8\">\n" +
                "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n" +
                "  <meta http-equiv=\"X-UA-Compatible\" content=\"IE=edge\">\n" +
                "  <meta name=\"color-scheme\" content=\"light dark\">\n" +
                "  <meta name=\"supported-color-schemes\" content=\"light dark\">\n" +
                "  <title>Employee HR Management System</title>\n" +
                "</head>\n" +
                "<body style=\"margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;\">\n" +
                "  <table role=\"presentation\" border=\"0\" cellpadding=\"0\" cellspacing=\"0\" width=\"100%\" style=\"background-color: #f8fafc; padding: 32px 16px;\">\n" +
                "    <tr>\n" +
                "      <td align=\"center\">\n" +
                "        <table role=\"presentation\" border=\"0\" cellpadding=\"0\" cellspacing=\"0\" width=\"100%\" style=\"max-width: 580px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); overflow: hidden;\">\n" +
                "          <!-- Header -->\n" +
                "          <tr>\n" +
                "            <td style=\"background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 24px 32px; text-align: left;\">\n" +
                "              <table role=\"presentation\" border=\"0\" cellpadding=\"0\" cellspacing=\"0\" width=\"100%\">\n" +
                "                <tr>\n" +
                "                  <td>\n" +
                "                    <div style=\"font-size: 18px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em;\">Employee HR Management System</div>\n" +
                "                    <div style=\"font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 4px;\">Account Security</div>\n" +
                "                  </td>\n" +
                "                </tr>\n" +
                "              </table>\n" +
                "            </td>\n" +
                "          </tr>\n" +
                "          <!-- Body -->\n" +
                "          <tr>\n" +
                "            <td style=\"padding: 32px 32px 24px;\">\n" +
                "              <h2 style=\"margin: 0 0 16px; font-size: 18px; font-weight: 600; color: #0f172a;\">Hello " + safeName + ",</h2>\n" +
                "              <p style=\"margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #334155;\">" + actionMessage + "</p>\n" +
                "              <!-- OTP Box -->\n" +
                "              <div style=\"background-color: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 8px; padding: 20px; text-align: center; margin: 28px 0;\">\n" +
                "                <span style=\"font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 34px; font-weight: 700; letter-spacing: 8px; color: #0f172a; display: inline-block;\">" + otp + "</span>\n" +
                "              </div>\n" +
                "              <!-- Notice -->\n" +
                "              <p style=\"margin: 0 0 12px; font-size: 14px; line-height: 1.6; color: #475569;\">\n" +
                "                This verification code expires in <strong>" + expiryMinutes + " minutes</strong>. For your security, do not share this code with anyone.\n" +
                "              </p>\n" +
                "              <p style=\"margin: 0 0 20px; font-size: 13px; line-height: 1.6; color: #64748b;\">\n" +
                "                " + ignoreText + "\n" +
                "              </p>\n" +
                "              <div style=\"background-color: #fefce8; border-left: 4px solid #eab308; padding: 12px 16px; border-radius: 4px; margin: 20px 0;\">\n" +
                "                <p style=\"margin: 0; font-size: 12px; line-height: 1.5; color: #854d0e;\">\n" +
                "                  <strong>Tip:</strong> If you cannot find this message in your Inbox, please check your Spam or Junk folder.\n" +
                "                </p>\n" +
                "              </div>\n" +
                "              <!-- Footer Sign-off -->\n" +
                "              <div style=\"border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 28px; font-size: 13px; color: #64748b; line-height: 1.5;\">\n" +
                "                <p style=\"margin: 0 0 4px;\">Regards,</p>\n" +
                "                <p style=\"margin: 0; font-weight: 600; color: #0f172a;\">Employee HR Management System</p>\n" +
                "                <p style=\"margin: 0; font-size: 12px; color: #94a3b8;\">Account Security Team</p>\n" +
                "              </div>\n" +
                "            </td>\n" +
                "          </tr>\n" +
                "        </table>\n" +
                "      </td>\n" +
                "    </tr>\n" +
                "  </table>\n" +
                "</body>\n" +
                "</html>";
    }

    private String escapeHtml(String text) {
        if (text == null) return "";
        return text.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}
