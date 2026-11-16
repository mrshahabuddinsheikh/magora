ALTER TABLE `orders` ADD `open_parcel` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `weight_grams` integer;--> statement-breakpoint
ALTER TABLE `orders` ADD `label_printed_at` integer;--> statement-breakpoint
ALTER TABLE `orders` ADD `packed_at` integer;--> statement-breakpoint
ALTER TABLE `orders` ADD `shipped_at` integer;--> statement-breakpoint
ALTER TABLE `orders` ADD `delivered_at` integer;--> statement-breakpoint
ALTER TABLE `orders` ADD `returned_at` integer;--> statement-breakpoint
ALTER TABLE `orders` ADD `return_type` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `return_reason` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `return_cost` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `orders_returned_idx` ON `orders` (`returned_at`);--> statement-breakpoint
-- backfill dates for existing orders from their timeline
UPDATE `orders` SET `delivered_at` = (SELECT max(`created_at`) FROM `order_events` e WHERE e.`order_id` = `orders`.`id` AND e.`status` = 'delivered') WHERE `status` = 'delivered';--> statement-breakpoint
UPDATE `orders` SET `shipped_at` = (SELECT min(`created_at`) FROM `order_events` e WHERE e.`order_id` = `orders`.`id` AND e.`status` IN ('shipped','out_for_delivery','delivered')) WHERE `status` IN ('shipped','out_for_delivery','delivered','returned');--> statement-breakpoint
UPDATE `orders` SET `returned_at` = coalesce((SELECT max(`created_at`) FROM `order_events` e WHERE e.`order_id` = `orders`.`id` AND e.`status` = 'returned'), `updated_at`), `return_type` = 'rto' WHERE `status` = 'returned';
