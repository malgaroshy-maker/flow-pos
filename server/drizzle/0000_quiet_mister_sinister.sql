CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`business_name` text DEFAULT 'اسم النشاط التجاري' NOT NULL,
	`business_phone` text,
	`business_address` text,
	`logo_path` text,
	`tax_enabled` integer DEFAULT false NOT NULL,
	`tax_rate_permille` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'LYD' NOT NULL,
	`theme_default` text DEFAULT 'light' NOT NULL
);
