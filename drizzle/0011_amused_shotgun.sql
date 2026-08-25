CREATE TABLE `conversation_attachments` (
	`id` varchar(48) NOT NULL,
	`ownerId` int NOT NULL,
	`conversationId` varchar(48) NOT NULL,
	`messageId` varchar(48),
	`originalName` varchar(320) NOT NULL,
	`mimeType` varchar(160) NOT NULL,
	`size` int NOT NULL,
	`storageKey` varchar(700) NOT NULL,
	`storageUrl` varchar(1024) NOT NULL,
	`kind` enum('image','document') NOT NULL,
	`analysisStatus` enum('ready','unsupported','failed') NOT NULL DEFAULT 'ready',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `conversation_attachments_id` PRIMARY KEY(`id`)
);
