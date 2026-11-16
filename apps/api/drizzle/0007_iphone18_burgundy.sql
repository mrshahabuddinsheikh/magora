-- iPhone 18 Pro / Pro Max: burgundy body (only if it still has the original silver, so admin edits are kept)
UPDATE `phone_models` SET `body_hex` = '#5c1a2b' WHERE `slug` IN ('iphone-18-pro-max', 'iphone-18-pro') AND `body_hex` = '#c8cacd';
