use std::{env, fs, process};

#[allow(dead_code)]
#[path = "../src/mdx.rs"]
mod mdx;

fn main() {
    let paths = env::args().skip(1).collect::<Vec<_>>();
    if paths.is_empty() {
        eprintln!("usage: cargo run --example validate_mdx -- <file.mdx> [...]");
        process::exit(2);
    }

    let mut failed = false;
    for path in paths {
        match fs::read_to_string(&path) {
            Ok(source) => {
                if let Err(error) = mdx::validate_mdx_document(&source, Some(path.clone())) {
                    failed = true;
                    eprintln!("{path}: {error}");
                }
            }
            Err(error) => {
                failed = true;
                eprintln!("{path}: {error}");
            }
        }
    }

    if failed {
        process::exit(1);
    }
}
