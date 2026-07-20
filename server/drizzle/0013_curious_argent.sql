CREATE TABLE `service_tickets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ticket_number` text NOT NULL,
	`warranty_id` integer,
	`serial_number` text NOT NULL,
	`product_name` text NOT NULL,
	`customer_id` integer,
	`customer_name` text,
	`customer_phone` text,
	`fault_description` text NOT NULL,
	`diagnosis` text,
	`parts` text,
	`in_warranty` integer DEFAULT true NOT NULL,
	`labor_cost` integer DEFAULT 0 NOT NULL,
	`parts_cost` integer DEFAULT 0 NOT NULL,
	`total_cost` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`user_id` integer NOT NULL,
	`created_at` text NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`warranty_id`) REFERENCES `warranties`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `service_tickets_ticket_number_unique` ON `service_tickets` (`ticket_number`);--> statement-breakpoint
CREATE TABLE `warranties` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sale_item_id` integer,
	`sale_id` integer,
	`serial_number` text NOT NULL,
	`product_name` text NOT NULL,
	`start_date` text NOT NULL,
	`months` integer NOT NULL,
	`end_date` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`sale_item_id`) REFERENCES `sale_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON UPDATE no action ON DELETE no action
);
