pub fn command_names() -> Vec<&'static str> {
    vec![
        "list_automation_templates",
        "list_routines",
        "create_routine",
        "update_routine",
        "delete_routine",
        "pause_routine",
        "resume_routine",
        "run_routine_now",
        "list_routine_runs",
        "get_automation_run",
    ]
}
