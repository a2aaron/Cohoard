use std::{collections::HashMap, error::Error};

use pulldown_cmark::html;
use serde::{Deserialize, Serialize};
use tera::{Context, Tera};
use wasm_bindgen::prelude::*;

pub mod config;
use config::Config;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[wasm_bindgen]
pub struct User {
    #[serde(flatten)]
    fields: HashMap<String, String>,
}

/// Represents a block of posts.
///
/// Each PostBlock renders the user headline plus some number of messages in the post body.
/// For the Discord template, a new PostBlock is usually issued whenever the following happens:
/// - The timestamp would change
/// - A message is sent by a different person than the previous person
#[derive(Debug, Clone, Serialize, Deserialize)]
#[wasm_bindgen]
pub struct PostBlock {
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

/// Parse a chatlog of messages into a list of [`PostBlock`] objects.
///
/// The `input` is a chatlog of messages, formatted in play-script style.
/// For example:
///
/// ```
/// A: Here's a series of messages as sent by A
/// A: Hello!
/// A: Hi!
/// B: Other people can also speak!
/// A: You can weave messages together seamlessly!
/// @ Today at 4:20 PM
/// B: If timestamps are used in the template, you can set them using an "@" symbol on it's own line
/// @ Tomorrow on Wednesday
/// C: The timestamp is freeform and can be any text.
/// ```
pub fn parse_posts(config: &Config, input: String) -> Vec<PostBlock> {
    let mut posts = vec![];

    let mut timestamp = None;

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
        timestamp: Option<String>,
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

        let post = PostBlock::new(user, timestamp, &messages);
        posts.push(post);

        messages.clear();
    }

    for line in input.lines() {
        // Lines starting with @ are timestamp messages
        // These have the format "@ Today at 4:13 PM" and update the timestamp
        // (The timestamp is actually freeform text, allowing for Goofs)
        if line.starts_with("@") {
            try_post(&config, &mut posts, &name, timestamp.clone(), &mut messages);

            let new_timestamp = line[1..].trim();
            if !new_timestamp.is_empty() {
                timestamp = Some(new_timestamp.to_string());
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
                            try_post(&config, &mut posts, &name, timestamp.clone(), &mut messages);
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

    try_post(&config, &mut posts, &name, timestamp.clone(), &mut messages);

    posts
}

/// Render a slice of PostBlocks using the given Tera template.
///
/// `template_name` is cosmetic--this is simply used for error reporting and debugging.
/// `template` should be contain the contents of the Tera template.
/// `posts` is a list of PostBlocks. This list should usually be produced by [`parse_posts`].
pub fn render(
    template_name: &str,
    template: &str,
    posts: &[PostBlock],
) -> Result<String, Box<dyn Error>> {
    let mut tera = Tera::default();
    tera.add_raw_template(template_name, template)?;
    tera.register_filter("markdown", markdown_to_html);

    let mut context = Context::new();
    context.insert("posts", &posts);

    let html = tera.render(template_name, &context)?;
    Ok(html)
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

pub mod js {
    use wasm_bindgen::prelude::*;

    #[wasm_bindgen]
    pub struct Config(JsValue);

    #[wasm_bindgen]
    pub struct PostBlockArray(JsValue);

    #[wasm_bindgen]
    pub fn parse_posts(config: &Config, input: String) -> Result<PostBlockArray, JsError> {
        let config = config.0.into_serde()?;
        let posts = super::parse_posts(&config, input);
        Ok(PostBlockArray(JsValue::from_serde(&posts)?))
    }

    #[wasm_bindgen]
    pub fn render(
        template_name: &str,
        template: &str,
        posts: &PostBlockArray,
    ) -> Result<String, JsError> {
        let posts = posts.0.into_serde::<Vec<_>>()?;
        super::render(template_name, template, &posts).map_err(|err| JsError::new(&err.to_string()))
    }

    #[wasm_bindgen]
    pub fn load_config(config: &str) -> Result<Config, JsError> {
        let config =
            crate::config::load_config(config).map_err(|err| JsError::new(&err.to_string()))?;
        Ok(Config(JsValue::from_serde(&config)?))
    }
}
