CREATE TABLE `knowledge_collections` (
	`id` varchar(48) NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`description` text NOT NULL,
	`classification` enum('private','restricted','shared') NOT NULL DEFAULT 'private',
	`status` enum('draft','ready','archived') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `knowledge_collections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `knowledge_sources` (
	`id` varchar(48) NOT NULL,
	`ownerId` int NOT NULL,
	`collectionId` varchar(48) NOT NULL,
	`workspaceFileId` varchar(48),
	`name` varchar(320) NOT NULL,
	`storageKey` varchar(700),
	`mimeType` varchar(160),
	`size` int,
	`indexingStatus` enum('registered','ready','unsupported','failed') NOT NULL DEFAULT 'registered',
	`chunkCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`indexedAt` timestamp,
	CONSTRAINT `knowledge_sources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `model_evaluations` (
	`id` varchar(48) NOT NULL,
	`ownerId` int NOT NULL,
	`objectiveId` varchar(48) NOT NULL,
	`collectionId` varchar(48),
	`modelId` varchar(160) NOT NULL,
	`status` enum('draft','ready','running','completed','failed') NOT NULL DEFAULT 'draft',
	`sampleCount` int NOT NULL DEFAULT 0,
	`passedCount` int NOT NULL DEFAULT 0,
	`score` int,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `model_evaluations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `model_objectives` (
	`id` varchar(48) NOT NULL,
	`ownerId` int NOT NULL,
	`title` varchar(160) NOT NULL,
	`category` enum('cyber_analysis','authorization_decisions','document_analysis','code_review','custom') NOT NULL,
	`description` text NOT NULL,
	`successCriteria` text NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `model_objectives_id` PRIMARY KEY(`id`)
);
