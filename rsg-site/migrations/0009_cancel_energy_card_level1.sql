-- 2026-11-23 林慧卿老師確認：「花園意識能量卡［I階］工作坊」整門課拿掉，改由「意識能量工作坊」（/archives/7586）承接。
UPDATE course_sessions SET data_json = json_set(data_json, '$.status', 'cancelled', '$.sourceChecked', '2026-11-23'), updated_at = CURRENT_TIMESTAMP WHERE id = 'rsg-7579-20261219';
