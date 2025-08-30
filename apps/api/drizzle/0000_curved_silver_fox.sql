CREATE TABLE `api_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token` text NOT NULL,
	`name` text,
	`prefix` text,
	`status` text DEFAULT 'active' NOT NULL,
	`usage_count` integer DEFAULT 0 NOT NULL,
	`last_used_at` integer,
	`last_used_ip` text,
	`created_at` integer NOT NULL,
	`revoked_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_tokens_token_unique` ON `api_tokens` (`token`);--> statement-breakpoint
CREATE INDEX `idx_tokens_status` ON `api_tokens` (`status`);--> statement-breakpoint
CREATE INDEX `idx_tokens_last_used` ON `api_tokens` (`last_used_at`);--> statement-breakpoint
CREATE TABLE `links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`url` text NOT NULL,
	`domain` text NOT NULL,
	`title` text,
	`original_description` text,
	`original_content` text,
	`ai_summary` text,
	`ai_category` text,
	`ai_tags` text,
	`user_description` text,
	`user_category` text,
	`user_tags` text,
	`final_description` text,
	`final_category` text,
	`final_tags` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`click_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	`published_at` integer,
	`search_text` text
);
--> statement-breakpoint
CREATE INDEX `idx_links_status` ON `links` (`status`);--> statement-breakpoint
CREATE INDEX `idx_links_domain` ON `links` (`domain`);--> statement-breakpoint
CREATE INDEX `idx_links_category` ON `links` (`final_category`);--> statement-breakpoint
CREATE INDEX `idx_links_published_at` ON `links` (`published_at`);--> statement-breakpoint
CREATE INDEX `idx_links_created_at` ON `links` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_links_status_published_at` ON `links` (`status`,`published_at`);--> statement-breakpoint
CREATE INDEX `idx_links_status_category_published` ON `links` (`status`,`final_category`,`published_at`);--> statement-breakpoint
CREATE TABLE `operation_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`action` text NOT NULL,
	`resource` text,
	`resource_id` integer,
	`details` text,
	`status` text DEFAULT 'success' NOT NULL,
	`error_message` text,
	`user_agent` text,
	`ip` text,
	`token_id` integer,
	`user_id` integer,
	`duration` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_logs_created_at` ON `operation_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_logs_action` ON `operation_logs` (`action`);--> statement-breakpoint
CREATE INDEX `idx_logs_resource` ON `operation_logs` (`resource`,`resource_id`);--> statement-breakpoint
CREATE INDEX `idx_logs_user_id` ON `operation_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_logs_token_id` ON `operation_logs` (`token_id`);--> statement-breakpoint
CREATE TABLE `search_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`query` text NOT NULL,
	`normalized_query` text,
	`results_count` integer,
	`response_time` integer,
	`filters` text,
	`sort_by` text,
	`clicked_results` text,
	`no_results_found` integer DEFAULT false,
	`ip` text,
	`user_agent` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_search_query` ON `search_logs` (`query`);--> statement-breakpoint
CREATE INDEX `idx_search_created_at` ON `search_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_search_no_results` ON `search_logs` (`no_results_found`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text,
	`type` text DEFAULT 'string' NOT NULL,
	`description` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`salt` text NOT NULL,
	`email` text,
	`display_name` text,
	`role` text DEFAULT 'admin' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`last_login_at` integer,
	`last_login_ip` text,
	`login_attempts` integer DEFAULT 0 NOT NULL,
	`locked_until` integer,
	`session_token` text,
	`session_expires_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE INDEX `idx_users_username` ON `users` (`username`);--> statement-breakpoint
CREATE INDEX `idx_users_session_token` ON `users` (`session_token`);--> statement-breakpoint
CREATE INDEX `idx_users_status` ON `users` (`status`);--> statement-breakpoint
CREATE INDEX `idx_users_last_login` ON `users` (`last_login_at`);--> statement-breakpoint
-- FTS5 Full-Text Search Implementation
CREATE VIRTUAL TABLE `links_fts` USING fts5(
  title, 
  final_description, 
  final_tags, 
  domain,
  final_category,
  content=links,
  content_rowid=id
);--> statement-breakpoint
-- FTS5 Synchronization Triggers
CREATE TRIGGER `links_fts_insert` AFTER INSERT ON `links` BEGIN
  INSERT INTO links_fts(rowid, title, final_description, final_tags, domain, final_category)
  VALUES (NEW.id, NEW.title, NEW.final_description, NEW.final_tags, NEW.domain, NEW.final_category);
END;--> statement-breakpoint
CREATE TRIGGER `links_fts_delete` AFTER DELETE ON `links` BEGIN
  INSERT INTO links_fts(links_fts, rowid, title, final_description, final_tags, domain, final_category)
  VALUES ('delete', OLD.id, OLD.title, OLD.final_description, OLD.final_tags, OLD.domain, OLD.final_category);
END;--> statement-breakpoint
CREATE TRIGGER `links_fts_update` AFTER UPDATE ON `links` BEGIN
  INSERT INTO links_fts(links_fts, rowid, title, final_description, final_tags, domain, final_category)
  VALUES ('delete', OLD.id, OLD.title, OLD.final_description, OLD.final_tags, OLD.domain, OLD.final_category);
  INSERT INTO links_fts(rowid, title, final_description, final_tags, domain, final_category)
  VALUES (NEW.id, NEW.title, NEW.final_description, NEW.final_tags, NEW.domain, NEW.final_category);
END;