pub fn command_names() -> Vec<&'static str> {
    vec![
        "list_all_journal_entries",
        "list_journal_entries",
        "list_available_months",
        "list_journal_entries_by_months",
        "list_journal_entries_paginated",
        "get_journal_entry_content",
        "save_journal_entry_content",
        "delete_journal_entry",
        "create_sample_entry_if_needed",
        "create_sample_entry",
        "import_file",
        "import_text",
        "import_text_temp",
        "import_image_temp",
    ]
}
