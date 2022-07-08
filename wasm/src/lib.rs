use std::error::Error;

use wasm_bindgen::prelude::*;

use cohoard_rs as cohoard;

#[wasm_bindgen]
pub struct Config(JsValue);

#[wasm_bindgen]
pub struct PostBlockArray(JsValue);

#[wasm_bindgen]
pub fn parse_posts(config: &Config, input: String) -> Result<PostBlockArray, JsError> {
    let config = config.0.into_serde()?;
    let posts = cohoard::parse_posts(&config, input);
    Ok(PostBlockArray(JsValue::from_serde(&posts)?))
}

fn get_full_msg(mut err: &dyn Error) -> String {
    let mut messages = vec![err.to_string()];
    while let Some(new_err) = err.source() {
        err = new_err;
        messages.push(err.to_string());
    }
    messages.join("\n")
}

#[wasm_bindgen]
pub fn render(
    template_name: &str,
    template: &str,
    posts: &PostBlockArray,
) -> Result<String, JsError> {
    let posts = posts.0.into_serde::<Vec<_>>()?;
    cohoard::render(template_name, template, &posts).map_err(|err| {
        // Try to parse out a Tera error message, if one was encountered during rendering.
        // TODO: provide more context?
        if let Some(tera_error) = err.source().and_then(|e| e.downcast_ref::<tera::Error>()) {
            if let tera::ErrorKind::Msg(msg) = &tera_error.kind {
                return JsError::new(msg);
            }
        }
        JsError::new(&get_full_msg(err.as_ref()))
    })
}

#[wasm_bindgen]
pub fn load_config(config: &str) -> Result<Config, JsError> {
    let config = cohoard::config::load_config(config)
        .map_err(|err| JsError::new(&get_full_msg(err.as_ref())))?;
    Ok(Config(JsValue::from_serde(&config)?))
}
