#[tauri::command]
pub fn compile_mdx(source: String, filepath: Option<String>) -> Result<String, String> {
    compile_mdx_source(&source, filepath)
}

pub fn compile_mdx_source(source: &str, filepath: Option<String>) -> Result<String, String> {
    let mut options = mdxjs::Options::gfm();
    options.parse.constructs.math_flow = true;
    options.parse.constructs.math_text = true;
    options.parse.math_text_single_dollar = true;
    options.filepath = filepath;
    let escaped = normalize_mdx_compatibility(source);
    mdxjs::compile(&escaped, &options).map_err(|e| e.to_string())
}

pub fn validate_mdx_document(source: &str, filepath: Option<String>) -> Result<(), String> {
    let stripped = strip_frontmatter(source);
    let preflight_issues = collect_mdx_preflight_issues(stripped.source, stripped.line_offset);
    let compile_result = compile_mdx_source(stripped.source, filepath)
        .map(|_| ())
        .map_err(|error| remap_error_line_numbers(&error, stripped.line_offset));

    match (preflight_issues.is_empty(), compile_result) {
        (true, Ok(())) => Ok(()),
        (true, Err(error)) => Err(error),
        (false, Ok(())) => Err(format_preflight_issues(&preflight_issues, None)),
        (false, Err(error)) => Err(format_preflight_issues(&preflight_issues, Some(&error))),
    }
}

struct StrippedMdxSource<'a> {
    source: &'a str,
    line_offset: usize,
}

fn strip_frontmatter(source: &str) -> StrippedMdxSource<'_> {
    let Some(rest) = source.strip_prefix("---") else {
        return StrippedMdxSource {
            source,
            line_offset: 0,
        };
    };

    let Some(end) = rest.find("\n---") else {
        return StrippedMdxSource {
            source,
            line_offset: 0,
        };
    };

    let body = &rest[end + 4..];
    let stripped_body = body.trim_start_matches(['\r', '\n']);
    let body_start = source.len() - stripped_body.len();

    StrippedMdxSource {
        source: stripped_body,
        line_offset: source[..body_start].bytes().filter(|b| *b == b'\n').count(),
    }
}

fn remap_error_line_numbers(error: &str, line_offset: usize) -> String {
    if line_offset == 0 {
        return error.to_string();
    }

    error
        .lines()
        .map(|line| remap_error_line_number(line, line_offset))
        .collect::<Vec<_>>()
        .join("\n")
}

fn remap_error_line_number(line: &str, line_offset: usize) -> String {
    let Some(first_colon) = line.find(':') else {
        return line.to_string();
    };

    let candidate = &line[..first_colon];
    if candidate.is_empty() || !candidate.chars().all(|ch| ch.is_ascii_digit()) {
        return line.to_string();
    }

    let Ok(line_number) = candidate.parse::<usize>() else {
        return line.to_string();
    };

    format!("{}{}", line_number + line_offset, &line[first_colon..])
}

#[derive(Debug)]
struct MdxPreflightIssue {
    line: usize,
    column: usize,
    message: String,
}

#[derive(Debug)]
struct OpenTag {
    name: String,
    line: usize,
    column: usize,
}

enum TagScan {
    Complete { end: usize, self_closing: bool },
    Malformed { column: usize, message: String },
    Incomplete,
}

fn collect_mdx_preflight_issues(source: &str, line_offset: usize) -> Vec<MdxPreflightIssue> {
    let mut issues = Vec::new();
    let mut stack: Vec<OpenTag> = Vec::new();
    let mut in_fence = false;

    for (line_index, line) in source.lines().enumerate() {
        let trimmed = line.trim_start();
        if trimmed.starts_with("```") || trimmed.starts_with("~~~") {
            in_fence = !in_fence;
            continue;
        }
        if in_fence {
            continue;
        }

        scan_mdx_line_for_jsx(line, line_offset + line_index + 1, &mut stack, &mut issues);
    }

    issues.extend(stack.into_iter().map(|tag| MdxPreflightIssue {
        line: tag.line,
        column: tag.column,
        message: format!("opening tag <{}> is not closed", tag.name),
    }));
    issues
}

fn scan_mdx_line_for_jsx(
    line: &str,
    line_number: usize,
    stack: &mut Vec<OpenTag>,
    issues: &mut Vec<MdxPreflightIssue>,
) {
    let mut index = 0;

    while index < line.len() {
        let Some(relative_lt) = line[index..].find('<') else {
            break;
        };
        let lt = index + relative_lt;
        let after_lt = lt + 1;
        let rest = &line[after_lt..];

        if rest.starts_with("!--") {
            index = line[after_lt..]
                .find("-->")
                .map_or(line.len(), |end| after_lt + end + 3);
            continue;
        }

        if rest.starts_with("http://") || rest.starts_with("https://") {
            index = line[after_lt..]
                .find('>')
                .map_or(after_lt, |end| after_lt + end + 1);
            continue;
        }

        let closing = rest.starts_with('/');
        let name_start = after_lt + usize::from(closing);
        let Some(first) = line[name_start..].chars().next() else {
            break;
        };
        if !first.is_ascii_alphabetic() {
            index = after_lt;
            continue;
        }

        let name_end = parse_jsx_tag_name_end(line, name_start);
        let name = &line[name_start..name_end];
        match scan_jsx_tag_tail(line, name_end) {
            TagScan::Complete { end, self_closing } => {
                if closing {
                    close_jsx_tag(name, line_number, byte_column(line, lt), stack, issues);
                } else if !self_closing && !is_void_tag(name) {
                    stack.push(OpenTag {
                        name: name.to_string(),
                        line: line_number,
                        column: byte_column(line, lt),
                    });
                }
                index = end + 1;
            }
            TagScan::Malformed { column, message } => {
                issues.push(MdxPreflightIssue {
                    line: line_number,
                    column,
                    message,
                });
                break;
            }
            TagScan::Incomplete => break,
        }
    }
}

fn parse_jsx_tag_name_end(line: &str, start: usize) -> usize {
    let mut end = start;
    while end < line.len() {
        let Some(ch) = line[end..].chars().next() else {
            break;
        };
        if ch.is_ascii_alphanumeric() || matches!(ch, '.' | '_' | '-' | ':') {
            end += ch.len_utf8();
        } else {
            break;
        }
    }
    end
}

fn scan_jsx_tag_tail(line: &str, start: usize) -> TagScan {
    let mut index = start;
    let mut quote: Option<(char, usize)> = None;
    let mut brace_depth = 0usize;
    let mut first_brace: Option<usize> = None;

    while index < line.len() {
        let Some(ch) = line[index..].chars().next() else {
            break;
        };

        if let Some((quote_ch, _)) = quote {
            if ch == quote_ch {
                quote = None;
            }
            index += ch.len_utf8();
            continue;
        }

        match ch {
            '"' | '\'' => quote = Some((ch, index)),
            '{' => {
                brace_depth += 1;
                first_brace.get_or_insert(index);
            }
            '}' => {
                brace_depth = brace_depth.saturating_sub(1);
                if brace_depth == 0 {
                    first_brace = None;
                }
            }
            '>' if brace_depth == 0 => {
                return TagScan::Complete {
                    end: index,
                    self_closing: line[..index].trim_end().ends_with('/'),
                };
            }
            _ => {}
        }
        index += ch.len_utf8();
    }

    if let Some((_, quote_index)) = quote {
        return TagScan::Malformed {
            column: byte_column(line, quote_index),
            message: "JSX attribute quote is not closed before the end of the line".to_string(),
        };
    }

    if let Some(brace_index) = first_brace {
        return TagScan::Malformed {
            column: byte_column(line, brace_index),
            message: "JSX expression brace is not closed before the end of the line".to_string(),
        };
    }

    TagScan::Incomplete
}

fn close_jsx_tag(
    name: &str,
    line: usize,
    column: usize,
    stack: &mut Vec<OpenTag>,
    issues: &mut Vec<MdxPreflightIssue>,
) {
    if stack.last().is_some_and(|tag| tag.name == name) {
        stack.pop();
        return;
    }

    if let Some(position) = stack.iter().rposition(|tag| tag.name == name) {
        let open = stack.pop().expect("stack has last item");
        issues.push(MdxPreflightIssue {
            line,
            column,
            message: format!(
                "closing tag </{}> does not match opening tag <{}> from line {}",
                name, open.name, open.line
            ),
        });
        stack.truncate(position);
        return;
    }

    issues.push(MdxPreflightIssue {
        line,
        column,
        message: format!("closing tag </{}> has no matching opening tag", name),
    });
}

fn is_void_tag(name: &str) -> bool {
    if name
        .chars()
        .next()
        .is_some_and(|ch| ch.is_ascii_uppercase())
    {
        return false;
    }

    matches!(
        name.to_ascii_lowercase().as_str(),
        "area"
            | "base"
            | "br"
            | "col"
            | "embed"
            | "hr"
            | "img"
            | "input"
            | "link"
            | "meta"
            | "param"
            | "source"
            | "track"
            | "wbr"
    )
}

fn byte_column(line: &str, byte_index: usize) -> usize {
    line[..byte_index].chars().count() + 1
}

fn format_preflight_issues(issues: &[MdxPreflightIssue], compiler_error: Option<&str>) -> String {
    let mut output = format!("MDX preflight found {} issue(s):", issues.len());
    for issue in issues {
        output.push_str(&format!(
            "\n- Line {}:{}: {}",
            issue.line, issue.column, issue.message
        ));
    }

    if let Some(error) = compiler_error {
        output.push_str("\n\nCompiler error:\n");
        output.push_str(error);
    }

    output
}

#[derive(Clone, Copy)]
enum MathKind {
    Inline,
    Block,
}

struct MathState {
    close: &'static str,
    kind: MathKind,
    value: String,
}

fn normalize_mdx_compatibility(source: &str) -> String {
    let mut escaped = String::with_capacity(source.len());
    let mut in_fence = false;
    let mut math_state: Option<MathState> = None;

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
        escaped.push_str(&normalize_mdx_line(line, &mut math_state));
    }

    if let Some(state) = math_state {
        push_math_component(&mut escaped, state.kind, &state.value);
    }

    escaped
}

fn normalize_mdx_line(line: &str, math_state: &mut Option<MathState>) -> String {
    let mut escaped = String::with_capacity(line.len());
    let mut in_inline_code = false;
    let mut brace_depth = 0usize;
    let mut i = 0usize;

    while i < line.len() {
        if let Some(state) = math_state {
            if line[i..].starts_with(state.close) {
                push_math_component(&mut escaped, state.kind, &state.value);
                i += state.close.len();
                *math_state = None;
                continue;
            }

            let Some(ch) = line[i..].chars().next() else {
                break;
            };
            state.value.push(ch);
            i += ch.len_utf8();
            continue;
        }

        let Some(ch) = line[i..].chars().next() else {
            break;
        };

        if !in_inline_code && brace_depth == 0 {
            if let Some(delimiter) = math_delimiter_at(line, i) {
                i += delimiter.open.len();
                *math_state = Some(MathState {
                    close: delimiter.close,
                    kind: delimiter.kind,
                    value: String::new(),
                });
                continue;
            }

            if let Some((url, next_i)) = markdown_autolink_at(line, i) {
                escaped.push('[');
                escaped.push_str(url);
                escaped.push_str("](");
                escaped.push_str(url);
                escaped.push(')');
                i = next_i;
                continue;
            }
        }

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
                && line[i + ch.len_utf8()..]
                    .chars()
                    .next()
                    .is_some_and(|next| next.is_ascii_digit()) =>
            {
                escaped.push_str("&lt;");
            }
            _ => escaped.push(ch),
        }
        i += ch.len_utf8();
    }

    escaped
}

struct MathDelimiter {
    open: &'static str,
    close: &'static str,
    kind: MathKind,
}

fn math_delimiter_at(line: &str, index: usize) -> Option<MathDelimiter> {
    for (open, close, kind) in [
        ("\\\\[", "\\\\]", MathKind::Block),
        ("\\\\(", "\\\\)", MathKind::Inline),
        ("\\[", "\\]", MathKind::Block),
        ("\\(", "\\)", MathKind::Inline),
    ] {
        if line[index..].starts_with(open) {
            return Some(MathDelimiter { open, close, kind });
        }
    }
    None
}

fn markdown_autolink_at(line: &str, index: usize) -> Option<(&str, usize)> {
    if !line[index..].starts_with('<') {
        return None;
    }

    let rest = &line[index + 1..];
    if !(rest.starts_with("http://") || rest.starts_with("https://")) {
        return None;
    }

    let end = rest.find('>')?;
    let url = &rest[..end];
    if url.chars().any(char::is_whitespace) {
        return None;
    }

    Some((url, index + 1 + end + 1))
}

fn push_math_component(out: &mut String, kind: MathKind, value: &str) {
    match kind {
        MathKind::Inline => out.push_str("<InlineMath math={"),
        MathKind::Block => out.push_str("<BlockMath math={"),
    }
    push_js_string_literal(out, value.trim());
    out.push_str("} />");
}

fn push_js_string_literal(out: &mut String, value: &str) {
    out.push('"');
    for ch in value.chars() {
        match ch {
            '\\' => out.push_str("\\\\"),
            '"' => out.push_str("\\\""),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            '\u{08}' => out.push_str("\\b"),
            '\u{0C}' => out.push_str("\\f"),
            '\u{2028}' => out.push_str("\\u2028"),
            '\u{2029}' => out.push_str("\\u2029"),
            _ => out.push(ch),
        }
    }
    out.push('"');
}

#[cfg(test)]
mod tests {
    use super::{compile_mdx_source, validate_mdx_document};

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
        let escaped = super::normalize_mdx_compatibility("<Progress value={stock<10 ? 1 : 0} />");

        assert!(escaped.contains("stock<10"));
    }

    #[test]
    fn compiles_markdown_autolinks() {
        let output = compile_mdx_source(
            "| Code |\n|---|\n| <https://github.com/tensorflow/tensor2tensor> |",
            Some("entry.mdx".to_string()),
        )
        .unwrap();

        assert!(output.contains("https://github.com/tensorflow/tensor2tensor"));
    }

    #[test]
    fn compiles_latex_style_math_components() {
        let output = compile_mdx_source(
            "\\\\[\\text{Attention}(Q, K, V) = \\frac{QK^T}{\\sqrt{d_k}}\\\\]",
            Some("entry.mdx".to_string()),
        )
        .unwrap();

        assert!(output.contains("BlockMath"));
        assert!(output.contains("Attention"));
        assert!(output.contains("d_k"));
    }

    #[test]
    fn math_compatibility_handles_multiline_display_blocks() {
        let output = compile_mdx_source(
            "\\\\[\nPE_{(pos, 2i)} = \\sin(pos / 10000^{2i/d_{model}})\n\\\\]",
            Some("entry.mdx".to_string()),
        )
        .unwrap();

        assert!(output.contains("BlockMath"));
        assert!(output.contains("PE_"));
        assert!(output.contains("model"));
    }

    #[test]
    fn math_compatibility_handles_inline_latex() {
        let output = compile_mdx_source(
            "输出维度为 \\\\(d_{model} = 512\\\\)，每头 \\\\(d_k = 64\\\\)。",
            Some("entry.mdx".to_string()),
        )
        .unwrap();

        assert!(output.contains("InlineMath"));
        assert!(output.contains("d_{model} = 512"));
        assert!(output.contains("d_k = 64"));
    }

    #[test]
    fn enables_dollar_math_constructs() {
        let output = compile_mdx_source(
            "输出维度为 $d_{model}$。\n\n$$\nPE_{pos}=sin(x)\n$$",
            Some("entry.mdx".to_string()),
        )
        .unwrap();

        assert!(output.contains("language-math math-inline"));
        assert!(output.contains("language-math math-display"));
    }

    #[test]
    fn validates_mdx_document_after_frontmatter() {
        let result = validate_mdx_document(
            "---\nsummary: ok\ntags: [journal]\n---\n\n# Good\n\n<Callout>Body</Callout>",
            Some("entry.mdx".to_string()),
        );

        assert!(result.is_ok());
    }

    #[test]
    fn validates_pascal_case_components_named_like_html_void_elements() {
        validate_mdx_document(
            "<Grid>\n  <Col span={6}>\n    content\n  </Col>\n</Grid>",
            Some("grid.mdx".to_string()),
        )
        .expect("PascalCase Col is an MDX component, not the HTML col void element");
    }

    #[test]
    fn mdx_validation_errors_use_original_source_line_numbers() {
        let error = validate_mdx_document(
            "---\nsummary: ok\ntags: [journal]\n---\n\n# Broken\n\n<Callout title=\"Missing close>",
            Some("entry.mdx".to_string()),
        )
        .unwrap_err();

        assert!(
            error.contains("Line 8:"),
            "expected preflight source line 8, got {error}"
        );
        assert!(
            error.contains("\n8:"),
            "expected compiler source line 8, got {error}"
        );
    }

    #[test]
    fn mdx_validation_reports_multiple_recoverable_syntax_issues() {
        let error = validate_mdx_document(
            "---\nsummary: bad\ntags: [journal]\n---\n\n# Broken\n\n<Callout title=\"Missing close>\n\n</Card>\n\n<Section>",
            Some("entry.mdx".to_string()),
        )
        .unwrap_err();

        assert!(error.contains("MDX preflight found 3 issue(s):"), "{error}");
        assert!(error.contains("Line 8:"), "{error}");
        assert!(error.contains("attribute quote"), "{error}");
        assert!(error.contains("Line 10:"), "{error}");
        assert!(
            error.contains("closing tag </Card> has no matching opening tag"),
            "{error}"
        );
        assert!(error.contains("Line 12:"), "{error}");
        assert!(
            error.contains("opening tag <Section> is not closed"),
            "{error}"
        );
        assert!(error.contains("Compiler error:"), "{error}");
    }
}
