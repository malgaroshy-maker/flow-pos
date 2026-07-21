CREATE TABLE `sale_return_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sale_return_id` integer NOT NULL,
	`sale_item_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`quantity` integer NOT NULL,
	FOREIGN KEY (`sale_return_id`) REFERENCES `sale_returns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sale_item_id`) REFERENCES `sale_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sale_returns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`return_number` text NOT NULL,
	`sale_id` integer NOT NULL,
	`customer_id` integer,
	`amount` integer NOT NULL,
	`refund_method` text NOT NULL,
	`user_id` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sale_returns_return_number_unique` ON `sale_returns` (`return_number`);--> statement-breakpoint
ALTER TABLE `sale_items` ADD `returned_quantity` integer DEFAULT 0 NOT NULL;