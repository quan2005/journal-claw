pub mod ai;
pub mod automation;
pub mod config_cmds;
pub mod conversation;
pub mod identity;
pub mod journal;
pub mod recording;
pub mod todos;
pub mod topics;
pub mod workspace;

/// Collect all command names from all domain modules for verification.
pub fn all_command_names() -> Vec<&'static str> {
    let mut names = Vec::new();
    names.extend(journal::command_names());
    names.extend(recording::command_names());
    names.extend(identity::command_names());
    names.extend(todos::command_names());
    names.extend(conversation::command_names());
    names.extend(config_cmds::command_names());
    names.extend(ai::command_names());
    names.extend(workspace::command_names());
    names.extend(automation::command_names());
    names.extend(topics::command_names());
    names
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn no_duplicate_command_names() {
        let names = all_command_names();
        let mut seen = std::collections::HashSet::new();
        for name in &names {
            assert!(seen.insert(name), "Duplicate command name: {}", name);
        }
    }

    #[test]
    fn all_commands_accounted_for() {
        let names = all_command_names();
        // The invoke_handler has ~128 commands as of v0.16
        // Allow some flexibility
        assert!(
            names.len() >= 100,
            "Expected at least 100 commands, got {}. Did you forget to add a domain?",
            names.len()
        );
    }
}
