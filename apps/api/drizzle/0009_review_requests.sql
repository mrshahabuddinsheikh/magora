ALTER TABLE `orders` ADD `review_requested_at` integer;--> statement-breakpoint
ALTER TABLE `reviews` ADD `order_id` integer REFERENCES orders(id);--> statement-breakpoint
ALTER TABLE `reviews` ADD `photos` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `reviews` ADD `admin_reply` text;--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_order_product_uq` ON `reviews` (`order_id`,`product_id`) WHERE order_id is not null;