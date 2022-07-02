use std::{io::Read, path::PathBuf};

use clap::Parser;
use serde::Serialize;
use tera::{Context, Tera};

#[derive(Debug, Clone, Serialize)]
struct User {
    name: String,
    color: String,
    avatar: String,
}

impl User {
    fn aaron() -> User {
        User {
            name: "SCP 7C: Delta Runic Gnar - Skim".into(),
            color: "#FF8200".into(),
            avatar: "ralsei_cropped.png".into(),
        }
    }

    fn cassie() -> User {
        User {
            name: "Cassie - 2%".into(),
            color: "#69C97A".into(),
            avatar: "cassie.webp".into(),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
struct Post {
    user: User,
    timestamp: String,
    messages: Vec<String>,
}

impl Post {
    fn new(user: &str, timestamp: &str, messages: &[String]) -> Post {
        let user = match user {
            "AARON" => User::aaron(),
            "CASSIE" => User::cassie(),
            _ => User {
                name: user.into(),
                color: "#FFFFFF".into(),
                avatar: "nothing.png".into(),
            },
        };

        Post {
            user,
            timestamp: timestamp.into(),
            messages: messages.into(),
        }
    }
}

fn parse_posts(input: String) -> Vec<Post> {
    let mut posts = vec![];

    let mut timestamp = String::from("Today");

    let mut name = String::new();
    let mut messages = vec![];

    for line in input.lines() {
        let line = line.trim();
        if line.is_empty() && !messages.is_empty() {
            let post = Post::new(&name, &timestamp, &messages);
            posts.push(post);
            messages.clear();
        } else if line.starts_with("@") {
            if !messages.is_empty() {
                let post = Post::new(&name, &timestamp, &messages);
                posts.push(post);
                messages.clear();
            }
            timestamp = line[1..].trim().to_string();
        } else {
            let split = line.split(": ").collect::<Vec<_>>();
            let next_name = split[0].to_string();
            let message = split[1].to_string();
            if next_name != name && !name.is_empty() {
                let post = Post::new(&name, &timestamp, &messages);
                posts.push(post);
                messages.clear();
            }
            name = next_name;
            messages.push(message);
        }
    }

    if !messages.is_empty() {
        let post = Post::new(&name, &timestamp, &messages);
        posts.push(post);
        messages.clear();
    }
    posts
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

    let posts = parse_posts(input);

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
