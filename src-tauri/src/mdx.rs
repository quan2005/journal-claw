#[tauri::command]
pub fn compile_mdx(source: String, filepath: Option<String>) -> Result<String, String> {
    compile_mdx_source(&source, filepath)
}

pub fn compile_mdx_source(source: &str, filepath: Option<String>) -> Result<String, String> {
    let mut options = mdxjs::Options::gfm();
    options.filepath = filepath;
    let escaped = escape_numeric_less_than(source);
    mdxjs::compile(&escaped, &options).map_err(|e| e.to_string())
}

fn escape_numeric_less_than(source: &str) -> String {
    let mut escaped = String::with_capacity(source.len());
    let mut in_fence = false;

    for line in source.split_inclusive('\n') {
        let trimmed = line.trim_start();
        if trimmed.starts_with("```") || trimmed.starts_with("~~~") {
            in_fence = !in_fence;
            escaped.push_str(line);
            continue;
        }
        if in_fence {
            escaped.push_str(line);
            continue;
        }
        escaped.push_str(&escape_numeric_less_than_line(line));
    }

    escaped
}

fn escape_numeric_less_than_line(line: &str) -> String {
    let mut escaped = String::with_capacity(line.len());
    let mut chars = line.chars().peekable();
    let mut in_inline_code = false;
    let mut brace_depth = 0usize;

    while let Some(ch) = chars.next() {
        match ch {
            '`' => {
                in_inline_code = !in_inline_code;
                escaped.push(ch);
            }
            '{' if !in_inline_code => {
                brace_depth += 1;
                escaped.push(ch);
            }
            '}' if !in_inline_code => {
                brace_depth = brace_depth.saturating_sub(1);
                escaped.push(ch);
            }
            '<' if !in_inline_code
                && brace_depth == 0
                && chars.peek().is_some_and(|next| next.is_ascii_digit()) =>
            {
                escaped.push_str("&lt;");
            }
            _ => escaped.push(ch),
        }
    }

    escaped
}

#[cfg(test)]
mod tests {
    use super::compile_mdx_source;

    #[test]
    fn compiles_basic_mdx() {
        let output = compile_mdx_source("# Hi!", Some("entry.mdx".to_string())).unwrap();

        assert!(output.contains("react/jsx-runtime"));
        assert!(output.contains("function MDXContent"));
        assert!(output.contains("export default MDXContent"));
    }

    #[test]
    fn enables_gfm() {
        let output = compile_mdx_source("| A |\n| - |\n| B |", None).unwrap();

        assert!(output.contains("table"));
        assert!(output.contains("tbody"));
    }

    #[test]
    fn compiles_less_than_numeric_prose() {
        let output = compile_mdx_source(
            "> 19% vs 0%，差距巨大且统计显著（p<0.001）。",
            Some("entry.mdx".to_string()),
        )
        .unwrap();

        assert!(output.contains("0.001"));
    }

    #[test]
    fn numeric_less_than_escape_preserves_jsx_expressions() {
        let escaped = super::escape_numeric_less_than("<Progress value={stock<10 ? 1 : 0} />");

        assert!(escaped.contains("stock<10"));
    }
}
