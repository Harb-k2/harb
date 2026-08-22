CREATE TABLE `cyber_owner_policies` (
	`id` varchar(48) NOT NULL,
	`ownerId` int NOT NULL,
	`analysisAction` enum('allow','approval','deny') NOT NULL DEFAULT 'allow',
	`passiveAction` enum('allow','approval','deny') NOT NULL DEFAULT 'allow',
	`activeAction` enum('allow','approval','deny') NOT NULL DEFAULT 'approval',
	`localAction` enum('allow','approval','deny') NOT NULL DEFAULT 'approval',
	`requireAuthorizationAcknowledgment` boolean NOT NULL DEFAULT true,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cyber_owner_policies_id` PRIMARY KEY(`id`),
	CONSTRAINT `cyber_owner_policies_ownerId_unique` UNIQUE(`ownerId`)
);
--> statement-breakpoint
ALTER TABLE `cyber_operations` ADD `authorizationAcknowledgedAt` timestamp;--> statement-breakpoint
ALTER TABLE `cyber_operations` ADD `resultSummary` text;