CREATE TABLE `addresses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`label` varchar(64) NOT NULL DEFAULT 'Home',
	`name` varchar(255) NOT NULL,
	`phone` varchar(64) NOT NULL,
	`city` varchar(128) NOT NULL,
	`area` varchar(255),
	`line1` text NOT NULL,
	`postal_code` varchar(32),
	`is_default` boolean NOT NULL DEFAULT false,
	CONSTRAINT `addresses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `blocked_phones` (
	`phone` varchar(64) NOT NULL,
	`reason` varchar(255),
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `blocked_phones_phone` PRIMARY KEY(`phone`)
);
--> statement-breakpoint
CREATE TABLE `brands` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`sort` int NOT NULL DEFAULT 0,
	`active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `brands_id` PRIMARY KEY(`id`),
	CONSTRAINT `brands_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `cart_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cart_id` varchar(64) NOT NULL,
	`variant_id` int NOT NULL,
	`qty` int NOT NULL,
	`custom` json,
	`custom_key` varchar(255) NOT NULL DEFAULT '',
	CONSTRAINT `cart_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `cart_items_uq2` UNIQUE(`cart_id`,`variant_id`,`custom_key`)
);
--> statement-breakpoint
CREATE TABLE `carts` (
	`id` varchar(64) NOT NULL,
	`user_id` int,
	`coupon_code` varchar(64),
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `carts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`section` varchar(64) NOT NULL DEFAULT 'magsafe-cases',
	`sort` int NOT NULL DEFAULT 0,
	CONSTRAINT `categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `categories_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `coupons` (
	`code` varchar(64) NOT NULL,
	`type` varchar(32) NOT NULL,
	`value` int NOT NULL DEFAULT 0,
	`min_subtotal` int NOT NULL DEFAULT 0,
	`max_discount` int,
	`usage_limit` int,
	`used_count` int NOT NULL DEFAULT 0,
	`expires_at` timestamp(3),
	`active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `coupons_code` PRIMARY KEY(`code`)
);
--> statement-breakpoint
CREATE TABLE `custom_styles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`section` varchar(64) NOT NULL DEFAULT 'magsafe-cases',
	`hint` varchar(255) NOT NULL DEFAULT '',
	`color` varchar(32) NOT NULL DEFAULT '#1f2024',
	`accent` varchar(32),
	`sort` int NOT NULL DEFAULT 0,
	`active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `custom_styles_id` PRIMARY KEY(`id`),
	CONSTRAINT `custom_styles_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `customer_leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`phone` varchar(64) NOT NULL,
	`name` varchar(255),
	`email` varchar(255),
	`city` varchar(128),
	`source` varchar(64) NOT NULL DEFAULT 'lead_popup',
	`preferred_model` varchar(255),
	`interests` text,
	`cart_value` int DEFAULT 0,
	`cart_items_summary` text,
	`last_visited_page` text,
	`visit_count` int NOT NULL DEFAULT 1,
	`converted_order` boolean NOT NULL DEFAULT false,
	`whatsapp_community_opt_in` boolean NOT NULL DEFAULT true,
	`notes` text,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `customer_leads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int NOT NULL,
	`status` varchar(64) NOT NULL,
	`note` text,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `order_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int NOT NULL,
	`variant_id` int,
	`product_id` int,
	`product_slug` varchar(255) NOT NULL,
	`product_name` varchar(255) NOT NULL,
	`model_name` varchar(255) NOT NULL,
	`color_name` varchar(128) NOT NULL,
	`color_hex` varchar(32) NOT NULL,
	`sku` varchar(128) NOT NULL,
	`unit_price` int NOT NULL,
	`qty` int NOT NULL,
	`line_total` int NOT NULL,
	`category` varchar(64) NOT NULL DEFAULT 'magsafe-cases',
	`material` varchar(64),
	`custom` json,
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`number` varchar(64) NOT NULL,
	`access_token` varchar(128) NOT NULL,
	`user_id` int,
	`status` varchar(64) NOT NULL DEFAULT 'pending',
	`payment_method` varchar(64) NOT NULL,
	`payment_status` varchar(64) NOT NULL DEFAULT 'unpaid',
	`customer_name` varchar(255) NOT NULL,
	`customer_phone` varchar(64) NOT NULL,
	`customer_email` varchar(255),
	`city` varchar(128) NOT NULL,
	`area` varchar(255),
	`line1` text NOT NULL,
	`postal_code` varchar(32),
	`notes` text,
	`subtotal` int NOT NULL,
	`discount` int NOT NULL DEFAULT 0,
	`shipping` int NOT NULL DEFAULT 0,
	`cod_fee` int NOT NULL DEFAULT 0,
	`total` int NOT NULL,
	`coupon_code` varchar(64),
	`source` varchar(32) NOT NULL DEFAULT 'web',
	`open_parcel` boolean NOT NULL DEFAULT true,
	`weight_grams` int,
	`label_printed_at` timestamp(3),
	`packed_at` timestamp(3),
	`shipped_at` timestamp(3),
	`delivered_at` timestamp(3),
	`returned_at` timestamp(3),
	`return_type` varchar(64),
	`return_reason` varchar(255),
	`return_cost` int NOT NULL DEFAULT 0,
	`review_requested_at` timestamp(3),
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_number_unique` UNIQUE(`number`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int NOT NULL,
	`provider` varchar(64) NOT NULL,
	`amount` int NOT NULL,
	`status` varchar(64) NOT NULL DEFAULT 'pending',
	`reference` varchar(255),
	`payload` json,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `phone_models` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brand_id` int NOT NULL,
	`slug` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`year` int NOT NULL,
	`aliases` varchar(500) NOT NULL DEFAULT '',
	`search_text` text NOT NULL,
	`height_mm` double NOT NULL,
	`width_mm` double NOT NULL,
	`depth_mm` double NOT NULL,
	`corner_radius_mm` double NOT NULL,
	`camera` json NOT NULL,
	`details` json NOT NULL,
	`body_hex` varchar(32) NOT NULL DEFAULT '#8a8d91',
	`price_adjust` int NOT NULL DEFAULT 0,
	`popular` boolean NOT NULL DEFAULT false,
	`is_hero` boolean NOT NULL DEFAULT false,
	`model_3d_url` text,
	`active` boolean NOT NULL DEFAULT true,
	`sort` int NOT NULL DEFAULT 0,
	CONSTRAINT `phone_models_id` PRIMARY KEY(`id`),
	CONSTRAINT `phone_models_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `product_brands` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`website` varchar(255),
	`sort` int NOT NULL DEFAULT 0,
	`active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `product_brands_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_brands_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `product_colors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`name` varchar(128) NOT NULL,
	`hex` varchar(32) NOT NULL,
	`accent_hex` varchar(32),
	`design_url` text,
	`sort` int NOT NULL DEFAULT 0,
	CONSTRAINT `product_colors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`subtitle` varchar(255) DEFAULT '',
	`description` text,
	`category_id` int NOT NULL,
	`brand` varchar(128) NOT NULL DEFAULT 'Magora',
	`material` varchar(64) NOT NULL,
	`base_price` int NOT NULL,
	`compare_at_price` int,
	`min_price` int NOT NULL DEFAULT 0,
	`badge` varchar(64),
	`view` json NOT NULL,
	`images` json NOT NULL,
	`features` json NOT NULL,
	`specs` json NOT NULL,
	`rating_avg` double NOT NULL DEFAULT 0,
	`rating_count` int NOT NULL DEFAULT 0,
	`sold_count` int NOT NULL DEFAULT 0,
	`featured` boolean NOT NULL DEFAULT false,
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`endpoint` varchar(500) NOT NULL,
	`p256dh` varchar(255) NOT NULL,
	`auth` varchar(255) NOT NULL,
	`phone` varchar(64),
	`user_id` int,
	`cart_id` varchar(64),
	`device_info` text,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`last_notified_at` timestamp(3),
	CONSTRAINT `push_subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `push_subscriptions_endpoint_unique` UNIQUE(`endpoint`)
);
--> statement-breakpoint
CREATE TABLE `return_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`return_id` int NOT NULL,
	`status` varchar(64) NOT NULL,
	`note` text,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `return_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `return_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`number` varchar(64) NOT NULL,
	`order_id` int NOT NULL,
	`user_id` int,
	`status` varchar(64) NOT NULL DEFAULT 'requested',
	`resolution` varchar(64) NOT NULL,
	`reason` varchar(255) NOT NULL,
	`details` text,
	`items` json NOT NULL,
	`exchange_note` text,
	`refund_amount` int NOT NULL DEFAULT 0,
	`refund_method` varchar(255),
	`admin_note` text,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `return_requests_id` PRIMARY KEY(`id`),
	CONSTRAINT `return_requests_number_unique` UNIQUE(`number`)
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`user_id` int,
	`name` varchar(255) NOT NULL,
	`rating` int NOT NULL,
	`title` varchar(255),
	`body` text NOT NULL,
	`verified` boolean NOT NULL DEFAULT false,
	`approved` boolean NOT NULL DEFAULT false,
	`order_id` int,
	`photos` json NOT NULL,
	`admin_reply` text,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `reviews_id` PRIMARY KEY(`id`),
	CONSTRAINT `reviews_order_product_uq` UNIQUE(`order_id`,`product_id`)
);
--> statement-breakpoint
CREATE TABLE `shipment_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shipment_id` int NOT NULL,
	`status` varchar(64) NOT NULL,
	`location` varchar(255),
	`note` text,
	`lat` double,
	`lng` double,
	`source` varchar(32) NOT NULL DEFAULT 'admin',
	`at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `shipment_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shipments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int NOT NULL,
	`courier` varchar(64) NOT NULL DEFAULT 'own',
	`tracking_number` varchar(128),
	`status` varchar(64) NOT NULL DEFAULT 'booked',
	`eta_at` timestamp(3),
	`rider_name` varchar(255),
	`rider_phone` varchar(64),
	`rider_token` varchar(128) NOT NULL,
	`last_lat` double,
	`last_lng` double,
	`last_location_at` timestamp(3),
	`current_location` varchar(255),
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `shipments_id` PRIMARY KEY(`id`),
	CONSTRAINT `shipments_order_id_unique` UNIQUE(`order_id`),
	CONSTRAINT `shipments_rider_token_unique` UNIQUE(`rider_token`)
);
--> statement-breakpoint
CREATE TABLE `shoppable_reels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`caption` text,
	`video_url` text NOT NULL,
	`thumbnail_url` text,
	`product_id` int,
	`product_name` varchar(255),
	`product_price` int,
	`product_compare_at_price` int,
	`product_slug` varchar(255),
	`product_image` text,
	`phone_model` varchar(255),
	`likes_count` int NOT NULL DEFAULT 18500,
	`views_count` int NOT NULL DEFAULT 45200,
	`comments_count` int NOT NULL DEFAULT 64,
	`shares_count` int NOT NULL DEFAULT 2300,
	`comments` json NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`sort` int NOT NULL DEFAULT 0,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `shoppable_reels_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stock_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`color_id` int,
	`phone_model_id` int,
	`phone` varchar(64) NOT NULL,
	`name` varchar(255),
	`notified_at` timestamp(3),
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `stock_alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trust_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(128) NOT NULL,
	`value` json NOT NULL,
	CONSTRAINT `trust_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `trust_settings_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `trust_signals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`city` varchar(128) NOT NULL,
	`product_name` varchar(255) NOT NULL,
	`product_slug` varchar(255) NOT NULL,
	`material` varchar(64) DEFAULT 'clear',
	`color_hex` varchar(32) NOT NULL DEFAULT '#1f2024',
	`model_name` varchar(255),
	`time_ago_text` varchar(64) NOT NULL DEFAULT 'Just now',
	`active` boolean NOT NULL DEFAULT true,
	`sort` int NOT NULL DEFAULT 0,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `trust_signals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`phone` varchar(64),
	`password_hash` varchar(255) NOT NULL,
	`role` varchar(32) NOT NULL DEFAULT 'customer',
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `variants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`phone_model_id` int,
	`color_id` int NOT NULL,
	`sku` varchar(128) NOT NULL,
	`price` int NOT NULL,
	`compare_at_price` int,
	`stock` int NOT NULL DEFAULT 0,
	`active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `variants_id` PRIMARY KEY(`id`),
	CONSTRAINT `variants_sku_unique` UNIQUE(`sku`),
	CONSTRAINT `variants_combo_uq` UNIQUE(`product_id`,`phone_model_id`,`color_id`)
);
--> statement-breakpoint
CREATE TABLE `wishlist` (
	`user_id` int NOT NULL,
	`product_id` int NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `wishlist_user_id_product_id_pk` PRIMARY KEY(`user_id`,`product_id`)
);
--> statement-breakpoint
ALTER TABLE `addresses` ADD CONSTRAINT `addresses_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cart_items` ADD CONSTRAINT `cart_items_cart_id_carts_id_fk` FOREIGN KEY (`cart_id`) REFERENCES `carts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cart_items` ADD CONSTRAINT `cart_items_variant_id_variants_id_fk` FOREIGN KEY (`variant_id`) REFERENCES `variants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `carts` ADD CONSTRAINT `carts_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_events` ADD CONSTRAINT `order_events_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_variant_id_variants_id_fk` FOREIGN KEY (`variant_id`) REFERENCES `variants`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `phone_models` ADD CONSTRAINT `phone_models_brand_id_brands_id_fk` FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_colors` ADD CONSTRAINT `product_colors_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_category_id_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `push_subscriptions` ADD CONSTRAINT `push_subscriptions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `return_events` ADD CONSTRAINT `return_events_return_id_return_requests_id_fk` FOREIGN KEY (`return_id`) REFERENCES `return_requests`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `return_requests` ADD CONSTRAINT `return_requests_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `return_requests` ADD CONSTRAINT `return_requests_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shipment_events` ADD CONSTRAINT `shipment_events_shipment_id_shipments_id_fk` FOREIGN KEY (`shipment_id`) REFERENCES `shipments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shipments` ADD CONSTRAINT `shipments_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shoppable_reels` ADD CONSTRAINT `shoppable_reels_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_alerts` ADD CONSTRAINT `stock_alerts_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_alerts` ADD CONSTRAINT `stock_alerts_color_id_product_colors_id_fk` FOREIGN KEY (`color_id`) REFERENCES `product_colors`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_alerts` ADD CONSTRAINT `stock_alerts_phone_model_id_phone_models_id_fk` FOREIGN KEY (`phone_model_id`) REFERENCES `phone_models`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `variants` ADD CONSTRAINT `variants_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `variants` ADD CONSTRAINT `variants_phone_model_id_phone_models_id_fk` FOREIGN KEY (`phone_model_id`) REFERENCES `phone_models`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `variants` ADD CONSTRAINT `variants_color_id_product_colors_id_fk` FOREIGN KEY (`color_id`) REFERENCES `product_colors`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `wishlist` ADD CONSTRAINT `wishlist_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `wishlist` ADD CONSTRAINT `wishlist_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `addresses_user_idx` ON `addresses` (`user_id`);--> statement-breakpoint
CREATE INDEX `order_events_order_idx` ON `order_events` (`order_id`);--> statement-breakpoint
CREATE INDEX `order_items_order_idx` ON `order_items` (`order_id`);--> statement-breakpoint
CREATE INDEX `orders_returned_idx` ON `orders` (`returned_at`);--> statement-breakpoint
CREATE INDEX `orders_user_idx` ON `orders` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `orders_status_idx` ON `orders` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `orders_phone_idx` ON `orders` (`customer_phone`);--> statement-breakpoint
CREATE INDEX `payments_order_idx` ON `payments` (`order_id`);--> statement-breakpoint
CREATE INDEX `phone_models_brand_idx` ON `phone_models` (`brand_id`,`sort`);--> statement-breakpoint
CREATE INDEX `product_colors_product_idx` ON `product_colors` (`product_id`);--> statement-breakpoint
CREATE INDEX `products_listing_idx` ON `products` (`active`,`category_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `products_price_idx` ON `products` (`active`,`min_price`);--> statement-breakpoint
CREATE INDEX `products_sold_idx` ON `products` (`active`,`sold_count`);--> statement-breakpoint
CREATE INDEX `products_featured_idx` ON `products` (`active`,`featured`);--> statement-breakpoint
CREATE INDEX `return_events_ret_idx` ON `return_events` (`return_id`);--> statement-breakpoint
CREATE INDEX `returns_order_idx` ON `return_requests` (`order_id`);--> statement-breakpoint
CREATE INDEX `returns_status_idx` ON `return_requests` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `returns_user_idx` ON `return_requests` (`user_id`);--> statement-breakpoint
CREATE INDEX `reviews_product_idx` ON `reviews` (`product_id`,`approved`,`created_at`);--> statement-breakpoint
CREATE INDEX `shipment_events_ship_idx` ON `shipment_events` (`shipment_id`,`at`);--> statement-breakpoint
CREATE INDEX `shipments_tracking_idx` ON `shipments` (`courier`,`tracking_number`);--> statement-breakpoint
CREATE INDEX `stock_alerts_product_idx` ON `stock_alerts` (`product_id`,`notified_at`);--> statement-breakpoint
CREATE INDEX `variants_model_idx` ON `variants` (`phone_model_id`,`product_id`);