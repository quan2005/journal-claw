pub fn command_names() -> Vec<&'static str> {
    vec![
        "conversation_create",
        "conversation_send",
        "conversation_cancel",
        "conversation_close",
        "conversation_inject",
        "conversation_truncate",
        "conversation_retry",
        "conversation_list",
        "conversation_rename",
        "conversation_delete",
        "conversation_load",
        "conversation_get_messages",
        "conversation_get_stats",
    ]
}
