#[tauri::command]
pub fn compile_mdx(source: String, filepath: Option<String>) -> Result<String, String> {
    compile_mdx_source(&source, filepath)
}

pub fn compile_mdx_source(source: &str, filepath: Option<String>) -> Result<String, String> {
    let mut options = mdxjs::Options::gfm();
    options.filepath = filepath;
    mdxjs::compile(source, &options).map_err(|e| e.to_string())
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
}
