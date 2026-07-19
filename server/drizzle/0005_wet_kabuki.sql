ALTER TABLE `customer_payments` ADD `shift_id` integer REFERENCES shifts(id);--> statement-breakpoint
ALTER TABLE `settings` ADD `discount_cap_percent` integer DEFAULT 10 NOT NULL;