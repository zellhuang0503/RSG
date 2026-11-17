UPDATE course_sessions SET data_json = json_set(data_json, '$.venue', '中部民宿', '$.sourceChecked', '2026-11-17'), updated_at = CURRENT_TIMESTAMP WHERE id = 'rsg-2061-20270324';
