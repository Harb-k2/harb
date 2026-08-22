ALTER TABLE `knowledge_sources` ADD `sourceType` enum('workspace_file','public_reference') DEFAULT 'workspace_file' NOT NULL;--> statement-breakpoint
ALTER TABLE `knowledge_sources` ADD `sourceType` enum('workspace_file','public_reference') NOT NULL DEFAULT 'workspace_file';--> statement-breakpoint
ALTER TABLE `knowledge_sources` ADD `sourceUrl` varchar(1024);--> statement-breakpoint
ALTER TABLE `knowledge_sources` ADD `licenseNote` varchar(1000);
