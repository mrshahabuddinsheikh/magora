CREATE TABLE `return_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`return_id` integer NOT NULL,
	`status` text NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`return_id`) REFERENCES `return_requests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `return_events_ret_idx` ON `return_events` (`return_id`);--> statement-breakpoint
CREATE TABLE `return_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`number` text NOT NULL,
	`order_id` integer NOT NULL,
	`user_id` integer,
	`status` text DEFAULT 'requested' NOT NULL,
	`resolution` text NOT NULL,
	`reason` text NOT NULL,
	`details` text,
	`items` text NOT NULL,
	`exchange_note` text,
	`refund_amount` integer DEFAULT 0 NOT NULL,
	`refund_method` text,
	`admin_note` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `return_requests_number_unique` ON `return_requests` (`number`);--> statement-breakpoint
CREATE INDEX `returns_order_idx` ON `return_requests` (`order_id`);--> statement-breakpoint
CREATE INDEX `returns_status_idx` ON `return_requests` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `returns_user_idx` ON `return_requests` (`user_id`);--> statement-breakpoint
CREATE TABLE `shipment_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shipment_id` integer NOT NULL,
	`status` text NOT NULL,
	`location` text,
	`note` text,
	`lat` real,
	`lng` real,
	`source` text DEFAULT 'admin' NOT NULL,
	`at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`shipment_id`) REFERENCES `shipments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `shipment_events_ship_idx` ON `shipment_events` (`shipment_id`,`at`);--> statement-breakpoint
CREATE TABLE `shipments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`courier` text DEFAULT 'own' NOT NULL,
	`tracking_number` text,
	`status` text DEFAULT 'booked' NOT NULL,
	`eta_at` integer,
	`rider_name` text,
	`rider_phone` text,
	`rider_token` text NOT NULL,
	`last_lat` real,
	`last_lng` real,
	`last_location_at` integer,
	`current_location` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shipments_order_id_unique` ON `shipments` (`order_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `shipments_rider_token_unique` ON `shipments` (`rider_token`);--> statement-breakpoint
CREATE INDEX `shipments_tracking_idx` ON `shipments` (`courier`,`tracking_number`);