use std::{error::Error, io::Read, path::PathBuf};

use clap::Parser as _;

use cohoard_rs as cohoard;

use cohoard::config;

#[derive(Debug, clap::Parser)]
#[clap(author, version, about = "a chatlog formatter for cohost", long_about = None)]
struct Args {
    /// The file containing the chatlog.
    in_file: Option<PathBuf>,
    /// The configuration file to use.
    #[clap(long, short, default_value = "config.yaml")]
    config: PathBuf,
    /// The file to write the HTML file to, if provided. Otherwise, prints to standard out.
    #[clap(long = "out", short)]
    out_file: Option<PathBuf>,
    /// The template file to use.
    #[clap(long, short, default_value = "templates/discord.html")]
    template: PathBuf,
}

fn main() -> Result<(), Box<dyn Error>> {
    let args = Args::parse();

    let config = std::fs::read_to_string(args.config)?;
    let config = config::load_config(&config)?;

    let input = if let Some(path) = args.in_file {
        std::fs::read_to_string(path)?
    } else {
        let mut string = String::new();
        std::io::stdin().read_to_string(&mut string)?;
        string
    };

    let posts = cohoard::parse_posts(&config, input);

    let template_contents = std::fs::read_to_string(&args.template)?;
    let html = cohoard::render(
        args.template.to_str().unwrap_or("template"),
        &template_contents,
        &posts,
        &config,
    )?;

    if let Some(out_path) = args.out_file {
        std::fs::write(out_path, html)?;
    } else {
        println!("{}", html);
    }

    Ok(())
}
