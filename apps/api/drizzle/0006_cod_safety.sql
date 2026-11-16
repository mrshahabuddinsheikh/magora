CREATE TABLE `blocked_phones` (
	`phone` text PRIMARY KEY NOT NULL,
	`reason` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stock_alerts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`color_id` integer,
	`phone_model_id` integer,
	`phone` text NOT NULL,
	`name` text,
	`notified_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`color_id`) REFERENCES `product_colors`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`phone_model_id`) REFERENCES `phone_models`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `stock_alerts_product_idx` ON `stock_alerts` (`product_id`,`notified_at`);