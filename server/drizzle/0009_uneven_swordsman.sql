CREATE TABLE `product_units` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`unit_name` text NOT NULL,
	`conversion_factor` integer NOT NULL,
	`price` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `customers` ADD `credit_limit` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `tax_exempt` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `sale_items` ADD `unit_name` text;--> statement-breakpoint
ALTER TABLE `sale_items` ADD `conversion_factor` integer DEFAULT 1 NOT NULL;