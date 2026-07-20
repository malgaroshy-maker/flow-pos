CREATE TABLE `stocktake_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`product_name` text NOT NULL,
	`barcode` text,
	`expected_qty` integer NOT NULL,
	`counted_qty` integer NOT NULL,
	`variance` integer NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `stocktake_sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `stocktake_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`user_id` integer NOT NULL,
	`username` text NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`closed_at` text,
	`applied_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
