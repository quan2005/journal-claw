pub fn command_names() -> Vec<&'static str> {
    vec![
        "trigger_ai_processing",
        "get_workspace_prompt",
        "set_workspace_prompt",
        "reset_workspace_prompt",
        "cancel_ai_processing",
        "cancel_queued_item",
        "trigger_ai_prompt",
        "get_auto_lint_status",
        "trigger_lint_now",
        "compile_mdx",
        "scan_legacy_directive_files",
        "apply_directive_migration",
    ]
}
