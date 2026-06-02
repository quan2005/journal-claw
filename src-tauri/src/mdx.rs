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
}
