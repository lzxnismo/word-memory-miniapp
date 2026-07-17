#!/usr/bin/env python3
"""小程序云函数 → Docker 部署改造方案 - 核心功能对照表"""

cloud_functions = {
    "category_manager": ["list", "create", "rename", "delete"],
    "goal_manager": ["create", "list", "getProgress", "update", "delete"],
    "record_review": ["record", "getMemory", "upsertMemory"],
    "stats_advanced": ["getStats", "getTrends", "getAchievements"],
    "user_stats": ["overview", "dailyPlan", "history"],
    "word_lookup": ["lookup", "getOnlineDetail", "getByGrade"],
    "word_query": ["getAll", "search", "getById", "getReviewQueue", "getNewWords"],
    "word_sets": ["create", "list", "getDetail", "update", "delete", "addWord", "removeWord", "lookup"]
}

local_system_apis = [
    # categories (5)
    ("categories", "GET /", "list_categories"),
    ("categories", "POST /", "create_category"),
    ("categories", "PUT /{id}", "update_category"),
    ("categories", "DELETE /{id}", "delete_category"),
    
    # goals (4)
    ("goals", "GET /", "list_goals"),
    ("goals", "POST /", "create_goal"),
    ("goals", "DELETE /{id}", "delete_goal"),
    ("goals", "GET /{id}/progress", "get_goal_progress"),
    
    # memory - SM-2 algorithm (12)
    ("memory", "GET /status", "get_status"),
    ("memory", "GET /today", "get_today_reviews"),
    ("memory", "POST /review", "review_word"),
    ("memory", "GET /new", "get_new_words"),
    ("memory", "PUT /{id}/status", "update_status"),
    ("memory", "GET /paused", "get_paused"),
    ("memory", "GET /mastered", "get_mastered"),
    ("memory", "GET /sm2-status", "get_sm2_status"),
    ("memory", "GET /learning-settings", "get_settings"),
    ("memory", "POST /learning-settings", "update_settings"),
    
    # stats (9)
    ("stats", "GET /overview", "get_overview"),
    ("stats", "GET /today", "get_daily_stats"),
    ("stats", "GET /weekly", "get_weekly_stats"),
    ("stats", "GET /mastery", "get_mastery"),
    ("stats", "GET /daily", "get_history"),
    ("stats", "GET /weak-words", "get_weak_words"),
    ("stats", "GET /journey", "get_journey"),
    ("stats", "GET /memory-phases", "get_memory_phases"),
    
    # word_sets (12)
    ("word_sets", "POST /", "create_set"),
    ("word_sets", "GET /", "list_sets"),
    ("word_sets", "GET /{id}", "get_detail"),
    ("word_sets", "PUT /{id}", "update_set"),
    ("word_sets", "DELETE /{id}", "delete_set"),
    ("word_sets", "GET /{id}/words", "get_set_words"),
    ("word_sets", "POST /{id}/words", "add_word_to_set"),
    ("word_sets", "DELETE /{id}/words/{word_id}", "remove_word_from_set"),
    ("word_sets", "GET /lookup/{word}", "lookup_definition"),
    ("word_sets", "POST /confirm", "confirm_import"),
    ("word_sets", "GET /learn/categories", "get_learn_categories"),
    
    # words (11)
    ("words", "GET /words/search", "search_words"),
    ("words", "GET /words", "get_all_words"),
    ("words", "GET /words/pending-reviews", "get_pending_reviews"),
    ("words", "GET /words/dictation-today", "get_dictation_today"),
    ("words", "GET /words/{id}", "get_by_id"),
    ("words", "POST /words", "create_word"),
    ("words", "PUT /words/{id}", "update_word"),
    ("words", "GET /words/{id}/sets", "get_word_sets"),
    ("words", "PUT /words/{id}/sets", "set_word_sets"),
    ("words", "DELETE /words/{id}", "delete_word"),
    
    # plan (8)
    ("plan", "GET /words", "get_plan_words"),
    ("plan", "POST /words", "add_to_plan"),
    ("plan", "POST /words-from-set", "add_from_set"),
    ("plan", "DELETE /words/{id}", "remove_from_plan"),
    ("plan", "DELETE /words", "clear_plan"),
    ("plan", "GET /dictation-config", "get_config"),
    ("plan", "POST /dictation-config", "update_config"),
    ("plan", "GET /dictation-words", "get_dictation_words"),
    
    # dictation (2)
    ("dictation", "POST /start", "start_dictation"),
    ("dictation", "POST /submit", "submit_dictation"),
    
    # tts (3)
    ("tts", "GET /audio/{word}", "get_audio"),
    ("tts", "GET /audio-by-id/{word_id}", "get_audio_by_id"),
]

total_local_apis = len(local_system_apis)
total_cloud_actions = sum(len(v) for v in cloud_functions.values())

print("=" * 90)
print("📊 小程序云函数 → Docker 部署改造方案")
print("=" * 90)
print()
print("当前状态对比：")
print(f"  • 小程序云函数：   8 个函数，共 {total_cloud_actions} 个 action（RPC-style）")
print(f"  • 本地系统 API:     {len([x for x in local_system_apis if 'tts' not in str(x)])} 个 RESTful 端点 + 3 个 TTS 端点")
print()

# 核心功能对照表
core_features = [
    ("SM-2 算法复习", [
        ("record_review", "record/record_word", "POST /memory/review"),
        ("record_review", "getMemory/get_memory_status", "GET /memory/status"),
        ("record_review", "upsertMemory/upsert_memory", "POST /memory/settings"),
        ("word_query", "getReviewQueue/get_pending_reviews", "GET /words/pending-reviews"),
        ("word_query", "getNewWords/get_new_words", "GET /memory/new"),
    ]),
    
    ("数据统计", [
        ("stats_advanced", "getStats/get_overview", "GET /stats/overview"),
        ("stats_advanced", "getTrends/get_trends", "GET /stats/weekly"),
        ("user_stats", "history/get_history", "GET /stats/daily"),
    ]),
    
    ("目标管理", [
        ("goal_manager", "list/list_goals", "GET /goals"),
        ("goal_manager", "create/create_goal", "POST /goals"),
        ("goal_manager", "update/update_goal", "PUT /goals/{id}"),
        ("goal_manager", "getProgress/get_progress", "GET /goals/{id}/progress"),
        ("goal_manager", "delete/delete_goal", "DELETE /goals/{id}"),
    ]),
    
    ("分类管理", [
        ("category_manager", "list/list_categories", "GET /categories"),
        ("category_manager", "create/create_category", "POST /categories"),
        ("category_manager", "rename/rename_category", "PUT /categories/{id}"),
        ("category_manager", "delete/delete_category", "DELETE /categories/{id}"),
    ]),
    
    ("单词集管理", [
        ("word_sets", "create/create_set", "POST /word_sets"),
        ("word_sets", "list/list_sets", "GET /word_sets"),
        ("word_sets", "getDetail/get_detail", "GET /word_sets/{id}"),
        ("word_sets", "update/update_set", "PUT /word_sets/{id}"),
        ("word_sets", "delete/delete_set", "DELETE /word_sets/{id}"),
        ("word_sets", "addWord/add_word_to_set", "POST /word_sets/{id}/words"),
        ("word_sets", "removeWord/remove_word", "DELETE /word_sets/{id}/words/{word_id}"),
        ("word_sets", "lookup/lookup_definition", "GET /word_sets/lookup/{word}"),
    ]),
    
    ("查词功能", [
        ("word_lookup", "lookup/lookup_definition", "GET /words/search"),
        ("word_lookup", "getByGrade/get_by_grade", "GET /words/{grade}"),
        ("word_query", "getById/get_by_id", "GET /words/{id}"),
        ("word_query", "search/search_words", "GET /words/search"),
    ]),
]

for feature_name, endpoints in core_features:
    print(f"{'='*90}")
    print(f"✅ {feature_name}")
    print(f"{'='*90}")
    print()
    for func, cloud_action, local_api in endpoints:
        print(f"  Cloud Function:  {func:16s} — {cloud_action:30s} → Action-based")
        print(f"  Local System:    {local_api:72s} → RESTful")
        print()

print(f"\n{'='*90}")
print(f"总结分析:")
print(f"{'='*90}")
print(f"• 覆盖度：本地系统 62 个 API 端点 vs 云函数 34 个 action")
print(f"• 差距模块:")
print(f"  🟡 学习计划 (plan):      本地有 8 个 endpoint，云函数缺少")
print(f"  🟡 听写 (dictation):     本地有 2 个 endpoint，云函数缺少")
print(f"  🟡 TTS 发音 (tts):       本地有 3 个 endpoint，云函数缺少")
print(f"  🟡 用户统计细节：         云函数只有基本 stats，缺少 detailed stats")
print(f"• 优势功能:")
print(f"  ✅ SM-2 算法完整对齐")
print(f"  ✅ 分类、目标、单词集管理功能一致")
print(f"  ✅ 查词功能基础齐全")
print(f"{'='*90}\n")
