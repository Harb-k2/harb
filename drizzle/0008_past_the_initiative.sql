CREATE TABLE `knowledge_chunks` (
	`id` varchar(48) NOT NULL,
	`ownerId` int NOT NULL,
	`collectionId` varchar(48) NOT NULL,
	`sourceId` varchar(48) NOT NULL,
	`chunkIndex` int NOT NULL,
	`excerpt` text NOT NULL,
	`contentHash` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `knowledge_chunks_id` PRIMARY KEY(`id`)
);
