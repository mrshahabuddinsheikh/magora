PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_variants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`phone_model_id` integer,
	`color_id` integer NOT NULL,
	`sku` text NOT NULL,
	`price` integer NOT NULL,
	`compare_at_price` integer,
	`stock` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`phone_model_id`) REFERENCES `phone_models`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`color_id`) REFERENCES `product_colors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_variants`("id", "product_id", "phone_model_id", "color_id", "sku", "price", "compare_at_price", "stock", "active") SELECT "id", "product_id", "phone_model_id", "color_id", "sku", "price", "compare_at_price", "stock", "active" FROM `variants`;--> statement-breakpoint
DROP TABLE `variants`;--> statement-breakpoint
ALTER TABLE `__new_variants` RENAME TO `variants`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `variants_sku_unique` ON `variants` (`sku`);--> statement-breakpoint
CREATE UNIQUE INDEX `variants_combo_uq` ON `variants` (`product_id`,`phone_model_id`,`color_id`);--> statement-breakpoint
CREATE INDEX `variants_model_idx` ON `variants` (`phone_model_id`,`product_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `variants_universal_uq` ON `variants` (`product_id`,`color_id`) WHERE phone_model_id is null;--> statement-breakpoint
ALTER TABLE `categories` ADD `section` text DEFAULT 'magsafe-cases' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `images` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
UPDATE `categories` SET `section` = `slug` WHERE `slug` IN ('skins', 'screen-protectors');