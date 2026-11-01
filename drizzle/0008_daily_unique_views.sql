CREATE TABLE `website_daily_uniques` (
	`day` text NOT NULL,
	`page` text NOT NULL,
	`visitor_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	PRIMARY KEY(`day`, `page`, `visitor_hash`)
);
--> statement-breakpoint
CREATE INDEX `website_daily_uniques_expiry_idx` ON `website_daily_uniques` (`expires_at`);
--> statement-breakpoint
-- A conflicting insert does nothing, so concurrent/repeated views increment a unique total only once.
-- Site and per-page estimates have different hashes and separate aggregate events.
CREATE TRIGGER `count_new_daily_unique`
AFTER INSERT ON `website_daily_uniques`
BEGIN
  INSERT INTO website_metrics(day,event,page,source,referrer,device,count,last_seen)
  VALUES(NEW.day,CASE WHEN NEW.page='*' THEN 'unique_visitor' ELSE 'unique_page_view' END,
    NEW.page,'direct','direct','unknown',1,CAST(strftime('%s',NEW.day) AS INTEGER)*1000)
  ON CONFLICT(day,event,page,source,referrer,device)
  DO UPDATE SET count=website_metrics.count+1,last_seen=excluded.last_seen;
END;
