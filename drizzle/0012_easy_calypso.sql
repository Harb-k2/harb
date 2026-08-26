ALTER TABLE `knowledge_sources` ADD `sourceCategory` enum('general','governance','cyber_network','code','vision','benchmark') DEFAULT 'general' NOT NULL;--> statement-breakpoint
ALTER TABLE `knowledge_sources` ADD `usageScope` enum('knowledge_reference','evaluation_only') DEFAULT 'knowledge_reference' NOT NULL;--> statement-breakpoint
ALTER TABLE `knowledge_sources` ADD `reviewStatus` enum('not_reviewed','rights_review_required','needs_source_url','rejected') DEFAULT 'not_reviewed' NOT NULL;--> statement-breakpoint
ALTER TABLE `knowledge_sources` ADD `rightsEvidenceUrl` varchar(1024);--> statement-breakpoint
ALTER TABLE `knowledge_sources` ADD `riskSummary` varchar(1000);