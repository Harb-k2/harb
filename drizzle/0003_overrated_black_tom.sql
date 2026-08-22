CREATE TABLE `file_access_approvals` (
	`id` varchar(48) NOT NULL,
	`ownerId` int NOT NULL,
	`fileId` varchar(48) NOT NULL,
	`action` enum('share','modify','delete') NOT NULL,
	`status` enum('requested','approved','rejected') NOT NULL DEFAULT 'requested',
	`requestedAt` timestamp NOT NULL DEFAULT (now()),
	`resolvedAt` timestamp,
	CONSTRAINT `file_access_approvals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `workspace_files` ADD `permissionState` enum('allowed','restricted','approval_required') DEFAULT 'allowed' NOT NULL;--> statement-breakpoint
ALTER TABLE `workspace_files` ADD `approvalState` enum('not_required','pending','approved','rejected') DEFAULT 'not_required' NOT NULL;--> statement-breakpoint
ALTER TABLE `workspace_files` ADD `lastApprovalAt` timestamp;