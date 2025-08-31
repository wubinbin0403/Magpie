CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text,
	`icon` text DEFAULT 'folder' NOT NULL,
	`color` text,
	`description` text,
	`display_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_name_unique` ON `categories` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `categories_slug_unique` ON `categories` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_categories_display_order` ON `categories` (`display_order`);--> statement-breakpoint
CREATE INDEX `idx_categories_is_active` ON `categories` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_categories_slug` ON `categories` (`slug`);