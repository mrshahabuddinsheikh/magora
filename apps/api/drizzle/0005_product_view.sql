ALTER TABLE `product_colors` ADD `design_url` text;--> statement-breakpoint
ALTER TABLE `products` ADD `view` text DEFAULT '{}' NOT NULL;