CREATE TABLE `base_model_selections` (
	`id` varchar(48) NOT NULL,
	`ownerId` int NOT NULL,
	`primaryModelId` varchar(160) NOT NULL,
	`fallbackModelId` varchar(160),
	`status` enum('draft','approved','superseded') NOT NULL DEFAULT 'draft',
	`rationale` text NOT NULL,
	`primaryEvaluationId` varchar(48),
	`fallbackEvaluationId` varchar(48),
	`catalogObservedAt` timestamp NOT NULL,
	`approvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `base_model_selections_id` PRIMARY KEY(`id`),
	CONSTRAINT `base_model_selections_ownerId_unique` UNIQUE(`ownerId`)
);
