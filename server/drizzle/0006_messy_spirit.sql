CREATE TABLE `customer_special_prices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`price` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `csp_customer_product_unique` ON `customer_special_prices` (`customer_id`,`product_id`);--> statement-breakpoint
ALTER TABLE `customers` ADD `tier` text DEFAULT 'retail' NOT NULL;