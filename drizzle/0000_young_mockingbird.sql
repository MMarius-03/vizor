CREATE TABLE `rift_rooms` (
	`code` text PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`revision` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`console_seen` integer DEFAULT 0 NOT NULL,
	`phone_seen` integer DEFAULT 0 NOT NULL
);
