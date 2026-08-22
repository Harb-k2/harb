CREATE TABLE `desktop_pairings` (
	`id` varchar(48) NOT NULL,
	`ownerId` int NOT NULL,
	`codeHash` varchar(128) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`consumedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `desktop_pairings_id` PRIMARY KEY(`id`),
	CONSTRAINT `desktop_pairings_codeHash_unique` UNIQUE(`codeHash`)
);
--> statement-breakpoint
ALTER TABLE `desktop_agents` ADD `agentTokenHash` varchar(128) NOT NULL;