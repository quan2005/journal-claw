// Template registry is consumed by automation commands in later tasks.
#![allow(dead_code)]

use crate::automation_types::{AutomationSchedule, AutomationScope, AutomationTemplate};

pub fn built_in_templates() -> Vec<AutomationTemplate> {
    vec![
        template(
            "daily-summary",
            "每日总结",
            "总结",
            "每天读取昨天，生成一篇自动化日志条目。",
            "阅读昨天的日志、待办变化和相关身份画像。请自主判断最合适的产物形式，通常创建一篇每日总结日志。不要向用户反问；信息不足时记录不确定性。结束前生成 run manifest。",
            AutomationSchedule::Daily {
                time: "08:00".to_string(),
                timezone: "Asia/Hong_Kong".to_string(),
            },
            AutomationScope::Relative {
                range: "yesterday".to_string(),
            },
            vec!["@todos.md", "@identities"],
        ),
        template(
            "weekly-summary",
            "周报总结",
            "总结",
            "每周聚合进展、会议脉络、待办状态和关键风险。",
            "阅读本周日志、待办和相关身份画像，生成一篇周报。突出项目进展、关键决策、风险和下周行动。可以自主创建日志或补充待办，结束前生成 run manifest。",
            AutomationSchedule::Weekly {
                weekday: 5,
                time: "17:30".to_string(),
                timezone: "Asia/Hong_Kong".to_string(),
            },
            AutomationScope::Relative {
                range: "this_week".to_string(),
            },
            vec!["@todos.md", "@done.md", "@identities"],
        ),
        template(
            "monthly-review",
            "月度回顾",
            "总结",
            "总结上月主题演进、重要人物、项目变化。",
            "阅读上月日志，生成月度回顾。关注长期主题、项目阶段变化、人物关系和未解决问题。可以自主创建或更新相关日志，结束前生成 run manifest。",
            AutomationSchedule::Monthly {
                day: 1,
                time: "09:00".to_string(),
                timezone: "Asia/Hong_Kong".to_string(),
            },
            AutomationScope::Relative {
                range: "last_month".to_string(),
            },
            vec!["@todos.md", "@identities"],
        ),
        template(
            "journal-lint",
            "日志库整理",
            "维护",
            "复用 /lint 规则，定期维护日志库。",
            "运行 /lint。严格遵守日志库维护规则：只整理关联记录区和 Identity 档案，不改日志正文，不改 raw/。结束前生成 run manifest。",
            AutomationSchedule::Weekly {
                weekday: 0,
                time: "03:00".to_string(),
                timezone: "Asia/Hong_Kong".to_string(),
            },
            AutomationScope::Workspace,
            vec!["@/lint"],
        ),
        template(
            "todo-digest",
            "待办提取与归并",
            "维护",
            "从近期日志提取行动项，更新 todos.md / done.md。",
            "阅读最近 24 小时日志，提取明确行动项，去重并更新 todos.md / done.md。保留来源路径。结束前生成 run manifest。",
            AutomationSchedule::Daily {
                time: "21:30".to_string(),
                timezone: "Asia/Hong_Kong".to_string(),
            },
            AutomationScope::RecentDays { days: 1 },
            vec!["@todos.md", "@done.md"],
        ),
        template(
            "identity-maintenance",
            "身份画像更新",
            "维护",
            "补充人物、项目、概念画像。",
            "阅读最近 7 天日志和 identities/，补充或修正人物、项目、概念画像。保留证据来源。结束前生成 run manifest。",
            AutomationSchedule::Weekly {
                weekday: 1,
                time: "09:00".to_string(),
                timezone: "Asia/Hong_Kong".to_string(),
            },
            AutomationScope::RecentDays { days: 7 },
            vec!["@identities"],
        ),
        template(
            "project-watch",
            "项目观察",
            "观察",
            "围绕项目或关键词持续观察。",
            "围绕用户配置的项目关键词或标签，阅读相关日志并生成观察报告。关注变化、阻塞、风险和下一步。结束前生成 run manifest。",
            AutomationSchedule::Daily {
                time: "22:00".to_string(),
                timezone: "Asia/Hong_Kong".to_string(),
            },
            AutomationScope::Keyword {
                query: "项目关键词".to_string(),
                range: Some(Box::new(AutomationScope::RecentDays { days: 7 })),
            },
            vec!["@todos.md", "@identities"],
        ),
        template(
            "person-watch",
            "人物动态追踪",
            "观察",
            "追踪指定人物相关动态和协作线索。",
            "围绕指定身份画像阅读近期日志，总结人物相关动态、承诺、协作风险和需要跟进的问题。结束前生成 run manifest。",
            AutomationSchedule::Weekly {
                weekday: 1,
                time: "10:00".to_string(),
                timezone: "Asia/Hong_Kong".to_string(),
            },
            AutomationScope::Identities {
                identity_ids: Vec::new(),
                range: Some(Box::new(AutomationScope::RecentDays { days: 7 })),
            },
            vec!["@identities", "@todos.md"],
        ),
        template(
            "topic-research",
            "主题研究",
            "观察",
            "持续整理某个主题的观察和材料。",
            "围绕指定主题阅读相关日志，沉淀趋势、证据、问题和下一步研究方向。结束前生成 run manifest。",
            AutomationSchedule::Weekly {
                weekday: 5,
                time: "16:00".to_string(),
                timezone: "Asia/Hong_Kong".to_string(),
            },
            AutomationScope::Keyword {
                query: "主题关键词".to_string(),
                range: Some(Box::new(AutomationScope::RecentDays { days: 30 })),
            },
            vec!["@topics"],
        ),
        template(
            "custom-agent",
            "自定义 Agent",
            "高级",
            "从空白 prompt 创建定时完整 Agent。",
            "请写清楚这个自动化要完成的目标、输入范围和产物要求。自动化运行时不会向用户反问，结束前必须生成 run manifest。",
            AutomationSchedule::Daily {
                time: "08:00".to_string(),
                timezone: "Asia/Hong_Kong".to_string(),
            },
            AutomationScope::Workspace,
            Vec::new(),
        ),
    ]
}

pub fn get_template(id: &str) -> Option<AutomationTemplate> {
    built_in_templates().into_iter().find(|t| t.id == id)
}

fn template(
    id: &str,
    title: &str,
    category: &str,
    description: &str,
    default_prompt: &str,
    default_schedule: AutomationSchedule,
    default_scope: AutomationScope,
    default_context: Vec<&str>,
) -> AutomationTemplate {
    AutomationTemplate {
        id: id.to_string(),
        title: title.to_string(),
        category: category.to_string(),
        description: description.to_string(),
        default_prompt: default_prompt.to_string(),
        default_schedule,
        default_scope,
        default_context: default_context.into_iter().map(|s| s.to_string()).collect(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::automation_schedule::validate_schedule;
    use std::collections::BTreeSet;

    const REQUIRED_TEMPLATE_IDS: [&str; 10] = [
        "daily-summary",
        "weekly-summary",
        "monthly-review",
        "journal-lint",
        "todo-digest",
        "identity-maintenance",
        "project-watch",
        "person-watch",
        "topic-research",
        "custom-agent",
    ];

    #[test]
    fn registry_contains_required_templates() {
        let ids: BTreeSet<String> = built_in_templates().into_iter().map(|t| t.id).collect();
        let expected: BTreeSet<String> = REQUIRED_TEMPLATE_IDS
            .iter()
            .map(|id| id.to_string())
            .collect();

        assert_eq!(ids, expected);
    }

    #[test]
    fn templates_have_valid_defaults() {
        for template in built_in_templates() {
            assert!(!template.id.trim().is_empty());
            assert!(!template.title.trim().is_empty());
            assert!(!template.category.trim().is_empty());
            assert!(!template.description.trim().is_empty());
            assert!(!template.default_prompt.trim().is_empty());
            validate_schedule(&template.default_schedule).unwrap();
        }
    }

    #[test]
    fn template_json_shape_is_stable() {
        let value = serde_json::to_value(get_template("daily-summary").unwrap()).unwrap();

        assert_eq!(value["id"], "daily-summary");
        assert_eq!(value["category"], "总结");
        assert_eq!(value["default_schedule"]["kind"], "daily");
        assert_eq!(value["default_schedule"]["time"], "08:00");
        assert_eq!(value["default_scope"]["kind"], "relative");
        assert_eq!(value["default_scope"]["range"], "yesterday");
    }

    #[test]
    fn custom_agent_is_marked_advanced() {
        let template = get_template("custom-agent").unwrap();
        assert_eq!(template.category, "高级");
    }

    #[test]
    fn journal_lint_prompt_uses_lint_skill() {
        let template = get_template("journal-lint").unwrap();
        assert!(template.default_prompt.contains("/lint"));
        assert!(template.default_prompt.contains("不改 raw/"));
    }
}
