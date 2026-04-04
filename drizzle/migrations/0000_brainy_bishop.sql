CREATE TABLE `active_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clinic_user_id` int NOT NULL,
	`token` varchar(255) NOT NULL,
	`last_access` datetime,
	`expires_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `active_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `active_sessions_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `clinic_users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clinic_id` int NOT NULL,
	`username` varchar(100) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`auth_pro_id` varchar(100),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `clinic_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `clinic_users_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
CREATE TABLE `clinics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clinic_id` varchar(50) NOT NULL,
	`name` varchar(255) NOT NULL,
	`drive_folder_id` varchar(255),
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clinics_id` PRIMARY KEY(`id`),
	CONSTRAINT `clinics_clinic_id_unique` UNIQUE(`clinic_id`)
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clinic_id` int NOT NULL,
	`upload_date` datetime,
	`study_type` varchar(100),
	`patient_name` varchar(255),
	`file_name` varchar(255),
	`drive_file_id` varchar(255),
	`preview_url` text,
	`download_url` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reports_id` PRIMARY KEY(`id`),
	CONSTRAINT `reports_drive_file_id_unique` UNIQUE(`drive_file_id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
