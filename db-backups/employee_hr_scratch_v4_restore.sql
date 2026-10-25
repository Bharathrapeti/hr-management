-- MySQL dump 10.13  Distrib 8.0.46, for Win64 (x86_64)
--
-- Host: localhost    Database: employee_hr_db
-- ------------------------------------------------------
-- Server version	8.0.46

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `employee_hr_db`
--



--
-- Table structure for table `auth_login_attempts`
--

DROP TABLE IF EXISTS `auth_login_attempts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `auth_login_attempts` (
  `attempt_id` bigint NOT NULL AUTO_INCREMENT,
  `email` varchar(320) COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_ip` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `succeeded` tinyint(1) NOT NULL DEFAULT '0',
  `attempted_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`attempt_id`),
  KEY `idx_auth_login_attempts` (`email`,`client_ip`,`attempted_at`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `auth_login_attempts`
--

LOCK TABLES `auth_login_attempts` WRITE;
/*!40000 ALTER TABLE `auth_login_attempts` DISABLE KEYS */;
INSERT INTO `auth_login_attempts` VALUES (1,'invalid@northstar.edu','0:0:0:0:0:0:0:1',0,'2026-10-23 16:34:44'),(3,'rapetibharath222@gmail.com','0:0:0:0:0:0:0:1',1,'2026-10-24 05:18:30'),(4,'rapetibharath222@gmail.com','0:0:0:0:0:0:0:1',1,'2026-10-24 07:45:09'),(5,'mithu2005.t@gmail.com','0:0:0:0:0:0:0:1',1,'2026-10-24 10:10:10'),(6,'bharathrajrapeti@gmail.com','0:0:0:0:0:0:0:1',0,'2026-10-24 10:11:34'),(7,'mithu2005.t@gmail.com','0:0:0:0:0:0:0:1',1,'2026-10-24 10:14:06'),(8,'rapetibharath222@gmail.com','0:0:0:0:0:0:0:1',1,'2026-10-24 10:26:16'),(10,'mithu2005.t@gmail.com','0:0:0:0:0:0:0:1',1,'2026-10-24 10:27:32'),(11,'rapetibharath222@gmail.com','0:0:0:0:0:0:0:1',1,'2026-10-24 10:28:28');
/*!40000 ALTER TABLE `auth_login_attempts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `auth_otp_requests`
--

DROP TABLE IF EXISTS `auth_otp_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `auth_otp_requests` (
  `request_id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `purpose` enum('SIGNUP','PASSWORD_RESET','HR_INVITATION') COLLATE utf8mb4_unicode_ci NOT NULL,
  `requested_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`request_id`),
  KEY `idx_auth_otp_requests_rate` (`user_id`,`purpose`,`requested_at`),
  CONSTRAINT `fk_auth_otp_requests_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `auth_otp_requests`
--

LOCK TABLES `auth_otp_requests` WRITE;
/*!40000 ALTER TABLE `auth_otp_requests` DISABLE KEYS */;
INSERT INTO `auth_otp_requests` VALUES (3,3,'SIGNUP','2026-10-23 17:13:13'),(4,3,'SIGNUP','2026-10-23 17:14:25'),(5,3,'SIGNUP','2026-10-23 17:29:55'),(6,3,'SIGNUP','2026-10-23 17:34:47'),(7,3,'SIGNUP','2026-10-23 17:37:05'),(10,3,'SIGNUP','2026-10-24 04:50:57'),(11,3,'SIGNUP','2026-10-24 05:17:36');
/*!40000 ALTER TABLE `auth_otp_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `auth_otps`
--

DROP TABLE IF EXISTS `auth_otps`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `auth_otps` (
  `otp_id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `purpose` enum('SIGNUP','PASSWORD_RESET','HR_INVITATION') COLLATE utf8mb4_unicode_ci NOT NULL,
  `otp_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` timestamp NOT NULL,
  `attempts` int NOT NULL DEFAULT '0',
  `used_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`otp_id`),
  KEY `idx_auth_otps_lookup` (`user_id`,`purpose`,`created_at`),
  KEY `idx_auth_otps_expiry` (`expires_at`),
  CONSTRAINT `fk_auth_otps_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `auth_otps`
--

LOCK TABLES `auth_otps` WRITE;
/*!40000 ALTER TABLE `auth_otps` DISABLE KEYS */;
INSERT INTO `auth_otps` VALUES (3,3,'SIGNUP','f85b8e6d966abce75d53828b631b93d31b56340f4aa475c16d0af12b12d15b02','2026-10-23 17:23:13',0,'2026-10-23 11:44:25','2026-10-23 17:13:13'),(4,3,'SIGNUP','72e613ffb6139e590c937fac0d7dc3e294074ac7f85f2197a93f36677b3b5861','2026-10-23 17:24:25',0,'2026-10-23 11:59:55','2026-10-23 17:14:25'),(5,3,'SIGNUP','b85a752256d90ff0e2f44dc6d0718d294f523ebe27917f03a31afa9421c81074','2026-10-23 17:39:55',0,'2026-10-23 12:04:47','2026-10-23 17:29:55'),(6,3,'SIGNUP','ed6180b758dbf420b68d7b247141222c2a4f5543f46840d55e3357bd7f4d5004','2026-10-23 17:44:47',0,'2026-10-23 12:07:05','2026-10-23 17:34:47'),(7,3,'SIGNUP','a3d3e08a8e7bb05021a301e270dcc2f5cd44f95c6a41c8bdf033fee05ccb6117','2026-10-23 17:47:06',0,'2026-10-23 23:20:57','2026-10-23 17:37:05'),(10,3,'SIGNUP','b530644b705527ee2c3258b6d5049c8bcaff2b3e6b47be85227731054a5bc9fe','2026-10-24 05:00:57',0,'2026-10-23 23:47:36','2026-10-24 04:50:57'),(11,3,'SIGNUP','a3ecbb057c56c96b12c28830daf6ecf61d726658a04fece978ef737f01b4fba3','2026-10-24 05:27:36',0,'2026-10-23 23:48:15','2026-10-24 05:17:36');
/*!40000 ALTER TABLE `auth_otps` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `auth_sessions`
--

DROP TABLE IF EXISTS `auth_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `auth_sessions` (
  `session_id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `token_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` timestamp NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `revoked_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`session_id`),
  UNIQUE KEY `token_hash` (`token_hash`),
  KEY `fk_auth_sessions_user` (`user_id`),
  KEY `idx_auth_sessions_active` (`token_hash`,`expires_at`,`revoked_at`),
  CONSTRAINT `fk_auth_sessions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `auth_sessions`
--

LOCK TABLES `auth_sessions` WRITE;
/*!40000 ALTER TABLE `auth_sessions` DISABLE KEYS */;
INSERT INTO `auth_sessions` VALUES (1,3,'060c2e75f09f26d9ea303911f15a5e2d64c3ff0894711298625f9a9837c45433','2026-10-24 13:18:31','2026-10-24 05:18:30',NULL),(2,3,'06cf057d773571e06a76cef9d1f51a086de7eccf737122564c9b84ab3d4d27a9','2026-10-24 15:45:10','2026-10-24 07:45:09',NULL),(3,4,'af8a6a317e0025d4b12e0f66f4e2874f7c2a6a1923f15fe38d7dfc2dd5585c10','2026-10-24 18:10:10','2026-10-24 10:10:10',NULL),(4,4,'f2631b62cff3529546577f19a6199fbf021b975f33adbacac212ddc9540a1ebc','2026-10-24 18:14:07','2026-10-24 10:14:07',NULL),(5,3,'74ed51789ae874d6f2ca987a2f4b339f0c16a8eca287e1987310c5b3b2b51167','2026-10-24 18:26:16','2026-10-24 10:26:16',NULL),(6,4,'02301d9b7897d8d0dde1f0f1d61599f089a74f130a41c38d065b5120404fd846','2026-10-24 18:27:33','2026-10-24 10:27:33',NULL),(7,3,'7559586b0a25fcde699e3c27964405683a0dc2cfbac21f9a78445536493ef18a','2026-10-24 18:28:28','2026-10-24 10:28:28',NULL);
/*!40000 ALTER TABLE `auth_sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `flyway_schema_history`
--

DROP TABLE IF EXISTS `flyway_schema_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `flyway_schema_history` (
  `installed_rank` int NOT NULL,
  `version` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `script` varchar(1000) COLLATE utf8mb4_unicode_ci NOT NULL,
  `checksum` int DEFAULT NULL,
  `installed_by` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `installed_on` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `execution_time` int NOT NULL,
  `success` tinyint(1) NOT NULL,
  PRIMARY KEY (`installed_rank`),
  KEY `flyway_schema_history_s_idx` (`success`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `flyway_schema_history`
--

LOCK TABLES `flyway_schema_history` WRITE;
/*!40000 ALTER TABLE `flyway_schema_history` DISABLE KEYS */;
INSERT INTO `flyway_schema_history` VALUES (1,'1','authentication','SQL','V1__authentication.sql',1881988468,'root','2026-10-23 16:11:38',308,1),(2,'2','manager access','SQL','V2__manager_access.sql',-746448293,'root','2026-10-23 16:11:39',330,1),(3,'3','employee approval','SQL','V3__employee_approval.sql',-995515416,'root','2026-10-24 10:03:04',200,1);
/*!40000 ALTER TABLE `flyway_schema_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `manager_access_requests`
--

DROP TABLE IF EXISTS `manager_access_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `manager_access_requests` (
  `request_id` bigint NOT NULL AUTO_INCREMENT,
  `requesting_user_id` bigint NOT NULL,
  `status` enum('PENDING','APPROVED','REJECTED','REVOKED') COLLATE utf8mb4_unicode_ci NOT NULL,
  `submitted_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reviewed_by_hr_user_id` bigint DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `review_reason` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pending_user_id` bigint GENERATED ALWAYS AS ((case when (`status` = _utf8mb4'PENDING') then `requesting_user_id` else NULL end)) STORED,
  PRIMARY KEY (`request_id`),
  UNIQUE KEY `pending_user_id` (`pending_user_id`),
  KEY `fk_manager_requests_reviewer` (`reviewed_by_hr_user_id`),
  KEY `idx_manager_requests_status` (`status`,`submitted_at`),
  KEY `idx_manager_requests_user` (`requesting_user_id`,`status`),
  CONSTRAINT `fk_manager_requests_reviewer` FOREIGN KEY (`reviewed_by_hr_user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `fk_manager_requests_user` FOREIGN KEY (`requesting_user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `manager_access_requests`
--

LOCK TABLES `manager_access_requests` WRITE;
/*!40000 ALTER TABLE `manager_access_requests` DISABLE KEYS */;
INSERT INTO `manager_access_requests` (`request_id`, `requesting_user_id`, `status`, `submitted_at`, `reviewed_by_hr_user_id`, `reviewed_at`, `review_reason`) VALUES (1,3,'APPROVED','2026-10-24 10:26:43',4,'2026-10-24 04:58:04',NULL);
/*!40000 ALTER TABLE `manager_access_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `manager_assignment_audit`
--

DROP TABLE IF EXISTS `manager_assignment_audit`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `manager_assignment_audit` (
  `audit_id` bigint NOT NULL AUTO_INCREMENT,
  `manager_user_id` bigint NOT NULL,
  `employee_user_id` bigint NOT NULL,
  `action` enum('ASSIGNED','REVOKED') COLLATE utf8mb4_unicode_ci NOT NULL,
  `changed_by_hr_user_id` bigint NOT NULL,
  `changed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reason` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`audit_id`),
  KEY `fk_manager_assignment_audit_employee` (`employee_user_id`),
  KEY `fk_manager_assignment_audit_actor` (`changed_by_hr_user_id`),
  KEY `idx_manager_assignment_audit_manager` (`manager_user_id`,`changed_at`),
  CONSTRAINT `fk_manager_assignment_audit_actor` FOREIGN KEY (`changed_by_hr_user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `fk_manager_assignment_audit_employee` FOREIGN KEY (`employee_user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `fk_manager_assignment_audit_manager` FOREIGN KEY (`manager_user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `manager_assignment_audit`
--

LOCK TABLES `manager_assignment_audit` WRITE;
/*!40000 ALTER TABLE `manager_assignment_audit` DISABLE KEYS */;
/*!40000 ALTER TABLE `manager_assignment_audit` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `manager_employee_assignments`
--

DROP TABLE IF EXISTS `manager_employee_assignments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `manager_employee_assignments` (
  `assignment_id` bigint NOT NULL AUTO_INCREMENT,
  `manager_user_id` bigint NOT NULL,
  `employee_user_id` bigint NOT NULL,
  `assigned_by_hr_user_id` bigint NOT NULL,
  `assigned_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `revoked_at` timestamp NULL DEFAULT NULL,
  `revoked_by_hr_user_id` bigint DEFAULT NULL,
  `revoke_reason` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `active_assignment_key` tinyint GENERATED ALWAYS AS ((case when (`revoked_at` is null) then 1 else NULL end)) STORED,
  PRIMARY KEY (`assignment_id`),
  UNIQUE KEY `uq_manager_active_assignment` (`manager_user_id`,`employee_user_id`,`active_assignment_key`),
  KEY `fk_manager_assignments_granter` (`assigned_by_hr_user_id`),
  KEY `fk_manager_assignments_revoker` (`revoked_by_hr_user_id`),
  KEY `idx_manager_assignments_manager` (`manager_user_id`,`revoked_at`),
  KEY `idx_manager_assignments_employee` (`employee_user_id`,`revoked_at`),
  CONSTRAINT `fk_manager_assignments_employee` FOREIGN KEY (`employee_user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `fk_manager_assignments_granter` FOREIGN KEY (`assigned_by_hr_user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `fk_manager_assignments_manager` FOREIGN KEY (`manager_user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `fk_manager_assignments_revoker` FOREIGN KEY (`revoked_by_hr_user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `manager_employee_assignments`
--

LOCK TABLES `manager_employee_assignments` WRITE;
/*!40000 ALTER TABLE `manager_employee_assignments` DISABLE KEYS */;
/*!40000 ALTER TABLE `manager_employee_assignments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `manager_permission_audit`
--

DROP TABLE IF EXISTS `manager_permission_audit`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `manager_permission_audit` (
  `audit_id` bigint NOT NULL AUTO_INCREMENT,
  `manager_user_id` bigint NOT NULL,
  `permission_code` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `action` enum('GRANTED','REVOKED') COLLATE utf8mb4_unicode_ci NOT NULL,
  `changed_by_hr_user_id` bigint NOT NULL,
  `changed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reason` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`audit_id`),
  KEY `fk_manager_permission_audit_actor` (`changed_by_hr_user_id`),
  KEY `idx_manager_permission_audit_manager` (`manager_user_id`,`changed_at`),
  CONSTRAINT `fk_manager_permission_audit_actor` FOREIGN KEY (`changed_by_hr_user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `fk_manager_permission_audit_manager` FOREIGN KEY (`manager_user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `manager_permission_audit`
--

LOCK TABLES `manager_permission_audit` WRITE;
/*!40000 ALTER TABLE `manager_permission_audit` DISABLE KEYS */;
/*!40000 ALTER TABLE `manager_permission_audit` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `manager_permissions`
--

DROP TABLE IF EXISTS `manager_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `manager_permissions` (
  `permission_id` bigint NOT NULL AUTO_INCREMENT,
  `manager_user_id` bigint NOT NULL,
  `permission_code` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `granted_by_hr_user_id` bigint NOT NULL,
  `granted_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `revoked_at` timestamp NULL DEFAULT NULL,
  `revoked_by_hr_user_id` bigint DEFAULT NULL,
  `revoke_reason` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `active_permission_key` tinyint GENERATED ALWAYS AS ((case when (`revoked_at` is null) then 1 else NULL end)) STORED,
  PRIMARY KEY (`permission_id`),
  UNIQUE KEY `uq_manager_active_permission` (`manager_user_id`,`permission_code`,`active_permission_key`),
  KEY `fk_manager_permissions_granter` (`granted_by_hr_user_id`),
  KEY `fk_manager_permissions_revoker` (`revoked_by_hr_user_id`),
  KEY `idx_manager_permissions_lookup` (`manager_user_id`,`revoked_at`),
  CONSTRAINT `fk_manager_permissions_granter` FOREIGN KEY (`granted_by_hr_user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `fk_manager_permissions_manager` FOREIGN KEY (`manager_user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `fk_manager_permissions_revoker` FOREIGN KEY (`revoked_by_hr_user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `manager_permissions`
--

LOCK TABLES `manager_permissions` WRITE;
/*!40000 ALTER TABLE `manager_permissions` DISABLE KEYS */;
/*!40000 ALTER TABLE `manager_permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `user_id` bigint NOT NULL AUTO_INCREMENT,
  `employee_id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(320) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` enum('EMPLOYEE','HR_ADMIN') COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('ACTIVE','INACTIVE','PENDING_APPROVAL','REJECTED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'INACTIVE',
  `email_verified_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `last_login_at` timestamp NULL DEFAULT NULL,
  `reviewed_by_hr_user_id` bigint DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `review_reason` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `employee_id` (`employee_id`),
  KEY `fk_users_reviewer` (`reviewed_by_hr_user_id`),
  KEY `idx_users_status_created` (`status`,`created_at`),
  CONSTRAINT `fk_users_reviewer` FOREIGN KEY (`reviewed_by_hr_user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (3,NULL,'Bharath','rapetibharath222@gmail.com','$2a$12$rSbaYIZ6Es.VVDfMBpG1leFFGp6AENUkNhX4UNL9o2obpBWtSuPkm','EMPLOYEE','ACTIVE','2026-10-23 23:48:15','2026-10-23 17:13:13','2026-10-24 10:28:28','2026-10-24 04:58:28',NULL,NULL,NULL),(4,NULL,'HR Administrator','mithu2005.t@gmail.com','$2a$12$KvT0TdBg1.KeuNdARpBcMOCFVhB5Sv5/VBTcJnxce7/TQ3QvvgVC2','HR_ADMIN','ACTIVE','2026-10-24 04:33:05','2026-10-24 10:03:05','2026-10-24 10:27:33','2026-10-24 04:57:33',NULL,NULL,NULL);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping events for database 'employee_hr_db'
--

--
-- Dumping routines for database 'employee_hr_db'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-24 22:15:47
