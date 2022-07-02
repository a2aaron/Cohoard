use std::{collections::HashMap, error::Error, io::Read, path::PathBuf};

use clap::Parser as _;
use config::Config;
use pulldown_cmark::html;
use serde::{Deserialize, Serialize};
use tera::{Context, Tera};

mod config;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    #[serde(flatten)]
    fields: HashMap<String, String>,
}

// Represents a block of posts. Each PostBlock renders the user headline plus
// some number of messages in the post body. A new PostBlock is usually issued
// whenever the following happen:
// - The time stamp would change
// - A different person posted something
#[derive(Debug, Clone, Serialize)]
struct PostBlock {
    user: User,
    timestamp: Option<String>,
    messages: Vec<String>,
}

impl PostBlock {
    fn new(user: User, timestamp: impl Into<Option<String>>, messages: &[String]) -> PostBlock {
        PostBlock {
            user,
            timestamp: timestamp.into(),
            messages: messages.into(),
        }
    }
}

fn parse_posts(config: &Config, input: String) -> Vec<PostBlock> {
    let mut posts = vec![];

    let mut timestamp = String::from("Today");

    let mut name = String::new();
    let mut messages = vec![];

    /// Creates a new PostBlock and adds it to `posts` if able.
    ///
    /// This function does nothing if `messages` is empty. If a new PostBlock was made,
    /// `messages` is cleared.
    fn try_post(
        config: &Config,
        posts: &mut Vec<PostBlock>,
        name: &str,
        timestamp: &str,
        messages: &mut Vec<String>,
    ) {
        if messages.is_empty() {
            return;
        }

        let user = config.people.get(name).cloned().unwrap_or({
            User {
                fields: [("name".to_string(), name.to_string())]
                    .into_iter()
                    .collect(),
            }
        });

        let post = PostBlock::new(user, timestamp.to_string(), &messages);
        posts.push(post);

        messages.clear();
    }

    for line in input.lines() {
        // Lines starting with @ are timestamp messages
        // These have the format "@ Today at 4:13 PM" and update the timestamp
        // (The timestamp is actually freeform text, allowing for Goofs)
        if line.starts_with("@") {
            try_post(&config, &mut posts, &name, &timestamp, &mut messages);

            let new_timestamp = line[1..].trim();
            if !new_timestamp.is_empty() {
                timestamp = new_timestamp.to_string();
            }
        } else {
            match line.split_once(": ") {
                Some((maybe_next_name, maybe_message)) => {
                    // Check if this is a line that looks like it starts with a name
                    // Ex: "AARON: bee removal"
                    // if it is, treat it as a new message. Otherwise, treat it
                    // as a multiline message.
                    // Note that multiline messages have slightly closer spacing
                    // compared to lines across different messages
                    if maybe_next_name
                        .chars()
                        .all(|x| x.is_alphabetic() && x.is_uppercase())
                    {
                        if maybe_next_name != name && !name.is_empty() {
                            try_post(&config, &mut posts, &name, &timestamp, &mut messages);
                        }
                        name = maybe_next_name.into();
                        messages.push(maybe_message.into());
                    } else {
                        messages.push(line.into());
                    }
                }
                None => {
                    if let Some(last_msg) = messages.last_mut() {
                        *last_msg += "<br>\n";
                        *last_msg += line;
                    } else {
                        messages.push(line.into())
                    }
                }
            };
        }
    }

    try_post(&config, &mut posts, &name, &timestamp, &mut messages);

    posts
}

fn markdown_to_html(
    value: &tera::Value,
    _: &HashMap<String, tera::Value>,
) -> tera::Result<tera::Value> {
    let value = value.as_str().ok_or(tera::Error::msg(
        "non-string value passed to markdown filter",
    ))?;
    let options = pulldown_cmark::Options::ENABLE_STRIKETHROUGH;
    let parser = pulldown_cmark::Parser::new_ext(value, options);

    let mut html = String::new();
    html::push_html(&mut html, parser);
    // pulldown-cmark adds <p> tags to the HTMLified text, which is undesirable since
    // this also adds a large margin to all the text contained within it. We can fix this
    // by simply removing all the <p> tags. This is safe and won't cause problems with
    // literal textual tags in the message, since those will already be escaped.
    // (and if they want an actual <p> tag, they should probably edit the HTML output of Cohoard,
    // as most of the time, a raw <p> will look ugly).
    let html = html.replace("<p>", "").replace("</p>", "");
    // Cohost doesn't accept <u>, so we need to replace it with a span that does the same thing.
    let html = html
        .replace("<u>", "<span style=\"text-decoration:underline\">")
        .replace("</u>", "</span>");

    Ok(tera::Value::String(html))
}

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
    #[clap(long, short, default_value = "discord.html")]
    template: String,
}

fn main() -> Result<(), Box<dyn Error>> {
    let args = Args::parse();

    let config = config::load_config(args.config)?;

    let input = if let Some(path) = args.in_file {
        std::fs::read_to_string(path)?
    } else {
        let mut string = String::new();
        std::io::stdin().read_to_string(&mut string)?;
        string
    };

    let posts = parse_posts(&config, input);

    let mut tera = Tera::new("templates/**/*.html")?;
    tera.register_filter("markdown", markdown_to_html);

    let mut context = Context::new();
    context.insert("posts", &posts);

    let html = tera.render(&args.template, &context)?;

    if let Some(out_path) = args.out_file {
        std::fs::write(out_path, html)?;
    } else {
        println!("{}", html);
    }

    Ok(())
}
