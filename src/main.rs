use std::{
    io::Read,
    path::{Path, PathBuf},
};

use clap::Parser;
use serde::Serialize;
use tera::{Context, Tera};

#[derive(Debug, Clone, Serialize)]
struct Post {
    user: String,
    user_color: String,
    user_avatar: String,
    contents: String,
}

impl Post {
    fn new(user: String, contents: String) -> Post {
        let (user, user_color, user_avatar) = match user.as_str() {
            "AARON" => (
                "SCP 7C: Delta Runic Gnar - Skim",
                "#FF8200",
                "ralsei_cropped.png",
            ),
            "CASSIE" => ("Cassie - 2%", "#69C97A", "cassie.webp"),
            _ => (user.as_str(), "#FFFFFF", "nothing.png"),
        };

        Post {
            user: user.to_string(),
            user_color: user_color.to_string(),
            user_avatar: user_avatar.to_string(),
            contents,
        }
    }
}

#[derive(Debug, clap::Parser)]
#[clap(author, version, about, long_about = None)]
struct Args {
    #[clap(long = "in", short)]
    in_file: Option<PathBuf>,
    #[clap(long = "out", short)]
    out_file: Option<PathBuf>,
}

fn main() {
    let args = Args::parse();

    let input = if let Some(path) = args.in_file {
        std::fs::read_to_string(path).unwrap()
    } else {
        let mut string = String::new();
        std::io::stdin().read_to_string(&mut string).unwrap();
        string
    };

    let posts = input
        .lines()
        .map(|line| {
            let split = line.split(": ").collect::<Vec<_>>();
            let user = split[0].to_string();
            let contents = split[1].to_string();
            Post::new(user, contents)
        })
        .collect::<Vec<_>>();

    let tera = Tera::new("templates/**/*.html").unwrap();

    let mut context = Context::new();
    context.insert("posts", &posts);

    let html = tera.render("discord.html", &context).unwrap();

    if let Some(out_path) = args.out_file {
        std::fs::write(out_path, html).unwrap();
    } else {
        println!("{}", html);
    }
}
