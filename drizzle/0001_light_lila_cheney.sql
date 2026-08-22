CREATE TABLE `approvals` (
	`id` varchar(48) NOT NULL,
	`ownerId` int NOT NULL,
	`taskId` varchar(48) NOT NULL,
	`action` varchar(64) NOT NULL,
	`riskLevel` enum('low','medium','high') NOT NULL DEFAULT 'high',
	`status` enum('requested','approved','rejected') NOT NULL DEFAULT 'requested',
	`summary` text NOT NULL,
	`expiresAt` timestamp,
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `approvals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_entries` (
	`id` varchar(48) NOT NULL,
	`ownerId` int NOT NULL,
	`eventType` varchar(64) NOT NULL,
	`requestId` varchar(48),
	`outcome` varchar(32) NOT NULL,
	`summary` text NOT NULL,
	`ruleIds` text NOT NULL,
	`metadata` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `desktop_agents` (
	`id` varchar(48) NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`operatingSystem` enum('windows','kali_linux') NOT NULL,
	`status` enum('offline','online','approval_required') NOT NULL DEFAULT 'offline',
	`scopes` text NOT NULL,
	`lastSeenAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `desktop_agents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `harb_tasks` (
	`id` varchar(48) NOT NULL,
	`ownerId` int NOT NULL,
	`request` text NOT NULL,
	`taskType` varchar(32) NOT NULL,
	`status` enum('queued','needs_approval','blocked','completed','failed') NOT NULL,
	`decision` varchar(32) NOT NULL,
	`decisionReason` text NOT NULL,
	`response` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `harb_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `owner_rules` (
	`id` varchar(48) NOT NULL,
	`ownerId` int NOT NULL,
	`title` varchar(160) NOT NULL,
	`description` text,
	`matchTerms` text NOT NULL,
	`scope` enum('all','general','command','file_change','data_share') NOT NULL DEFAULT 'all',
	`action` enum('allow','approval','deny') NOT NULL DEFAULT 'approval',
	`priority` int NOT NULL DEFAULT 100,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `owner_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workspace_files` (
	`id` varchar(48) NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(320) NOT NULL,
	`mimeType` varchar(160) NOT NULL,
	`size` int NOT NULL,
	`storageKey` varchar(700) NOT NULL,
	`storageUrl` varchar(1024) NOT NULL,
	`classification` enum('private','restricted','shared') NOT NULL DEFAULT 'private',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `workspace_files_id` PRIMARY KEY(`id`)
);
