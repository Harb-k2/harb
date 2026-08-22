CREATE TABLE `cyber_assets` (
	`id` varchar(48) NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`assetValue` varchar(512) NOT NULL,
	`assetType` enum('domain','ip','web_app','api','host','cloud','repository','local_device') NOT NULL,
	`environment` enum('production','staging','development','lab') NOT NULL DEFAULT 'lab',
	`authorizationRef` varchar(320) NOT NULL,
	`permittedScope` text NOT NULL,
	`status` enum('authorized','suspended','expired') NOT NULL DEFAULT 'authorized',
	`validUntil` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cyber_assets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cyber_operations` (
	`id` varchar(48) NOT NULL,
	`ownerId` int NOT NULL,
	`assetId` varchar(48) NOT NULL,
	`operationType` enum('analysis','passive_validation','active_test','local_execution') NOT NULL,
	`riskLevel` enum('low','medium','high') NOT NULL,
	`decision` enum('allow','approval','deny') NOT NULL,
	`status` enum('planned','awaiting_approval','blocked','approved','completed','failed') NOT NULL,
	`requestSummary` text NOT NULL,
	`decisionReason` text NOT NULL,
	`plan` text NOT NULL,
	`approvalId` varchar(48),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `cyber_operations_id` PRIMARY KEY(`id`)
);
