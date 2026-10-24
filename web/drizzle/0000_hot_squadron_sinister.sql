CREATE TABLE `candidates` (
	`election` text NOT NULL,
	`id` text NOT NULL,
	`label` text NOT NULL,
	PRIMARY KEY(`election`, `id`),
	FOREIGN KEY (`election`) REFERENCES `elections`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `elections` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`title` text NOT NULL,
	`state` text DEFAULT 'OPEN' NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `eligible` (
	`election` text NOT NULL,
	`voter` text NOT NULL,
	PRIMARY KEY(`election`, `voter`),
	FOREIGN KEY (`election`) REFERENCES `elections`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`election` text NOT NULL,
	`voter` text,
	`code` text NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`election`) REFERENCES `elections`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`election` text NOT NULL,
	`voter` text NOT NULL,
	`candidate` text NOT NULL,
	`request` text NOT NULL,
	`code` text NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`election`) REFERENCES `elections`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_request` ON `submissions` (`election`,`voter`,`request`);--> statement-breakpoint
CREATE UNIQUE INDEX `one_accepted_vote` ON `submissions` (`election`,`voter`) WHERE "submissions"."code" = 'ACCEPTED';--> statement-breakpoint
CREATE INDEX `submissions_election` ON `submissions` (`election`);