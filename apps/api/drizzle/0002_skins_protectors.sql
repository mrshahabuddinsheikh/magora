DROP INDEX `cart_items_uq`;--> statement-breakpoint
ALTER TABLE `cart_items` ADD `custom` text;--> statement-breakpoint
ALTER TABLE `cart_items` ADD `custom_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `cart_items_uq2` ON `cart_items` (`cart_id`,`variant_id`,`custom_key`);--> statement-breakpoint
ALTER TABLE `order_items` ADD `category` text DEFAULT 'magsafe-cases' NOT NULL;--> statement-breakpoint
ALTER TABLE `order_items` ADD `material` text;--> statement-breakpoint
ALTER TABLE `order_items` ADD `custom` text;