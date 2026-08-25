CREATE TABLE `benchmark_cases` (
	`id` varchar(48) NOT NULL,
	`ownerId` int NOT NULL,
	`title` varchar(180) NOT NULL,
	`prompt` text NOT NULL,
	`successCriteria` text NOT NULL,
	`evidenceReference` varchar(700) NOT NULL,
	`language` varchar(32) NOT NULL DEFAULT 'auto',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `benchmark_cases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `benchmark_results` (
	`id` varchar(48) NOT NULL,
	`ownerId` int NOT NULL,
	`runId` varchar(48) NOT NULL,
	`caseId` varchar(48) NOT NULL,
	`modelId` varchar(160) NOT NULL,
	`response` text,
	`responseLanguage` varchar(32) NOT NULL DEFAULT 'auto',
	`status` enum('completed','failed') NOT NULL DEFAULT 'completed',
	`reviewerScore` int,
	`reviewerNotes` text,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `benchmark_results_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `benchmark_runs` (
	`id` varchar(48) NOT NULL,
	`ownerId` int NOT NULL,
	`modelIds` text NOT NULL,
	`caseCount` int NOT NULL,
	`status` enum('running','completed','failed') NOT NULL DEFAULT 'running',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `benchmark_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `conversation_messages` (
	`id` varchar(48) NOT NULL,
	`ownerId` int NOT NULL,
	`conversationId` varchar(48) NOT NULL,
	`taskId` varchar(48),
	`role` enum('user','assistant') NOT NULL,
	`content` text NOT NULL,
	`language` varchar(32) NOT NULL DEFAULT 'auto',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `conversation_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` varchar(48) NOT NULL,
	`ownerId` int NOT NULL,
	`title` varchar(180) NOT NULL,
	`detectedLanguage` varchar(32) NOT NULL DEFAULT 'auto',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `message_feedback` (
	`id` varchar(48) NOT NULL,
	`ownerId` int NOT NULL,
	`messageId` varchar(48) NOT NULL,
	`rating` enum('up','down') NOT NULL,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `message_feedback_id` PRIMARY KEY(`id`)
);
