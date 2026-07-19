CREATE TABLE `quotation_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`quotation_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`product_name` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price` integer NOT NULL,
	`total` integer NOT NULL,
	FOREIGN KEY (`quotation_id`) REFERENCES `quotations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `quotations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`quote_number` text NOT NULL,
	`customer_id` integer,
	`customer_name` text,
	`user_id` integer NOT NULL,
	`valid_until` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`discount` integer DEFAULT 0 NOT NULL,
	`tax_amount` integer DEFAULT 0 NOT NULL,
	`total` integer NOT NULL,
	`converted_sale_id` integer,
	`notes` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`converted_sale_id`) REFERENCES `sales`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quotations_quote_number_unique` ON `quotations` (`quote_number`);