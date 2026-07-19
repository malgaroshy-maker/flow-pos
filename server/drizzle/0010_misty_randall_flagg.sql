ALTER TABLE `quotation_items` ADD `unit_id` integer REFERENCES product_units(id);--> statement-breakpoint
ALTER TABLE `quotation_items` ADD `unit_name` text;--> statement-breakpoint
ALTER TABLE `quotation_items` ADD `conversion_factor` integer DEFAULT 1 NOT NULL;