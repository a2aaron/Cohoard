use std::{collections::HashMap, error::Error};

use serde::{Deserialize, Serialize};

use crate::User;

#[derive(Debug, Clone, Deserialize)]
struct UserSchema {
    key: String,
    #[serde(flatten)]
    user: User,
}

#[derive(Debug, Clone, Deserialize)]
struct ConfigSchema {
    people: Vec<UserSchema>,
}

/// A configuration struct detailing what properties each poster has.
///
/// Each poster has a unique name (usually in all-caps) and can detail things like
/// their avatar, display name, handle, and other common properies.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub people: HashMap<String, User>,
}

/// Load a configuration file from `yaml` text.
///
/// The yaml scheme is similar to this:
/// ```yaml
/// people:
/// - key: KARKAT
///   name: Karkat Vantas
///   handle: carcinoGeneticist
///   color: "#626262" # this can be any CSS color
///   avatar: your_url_to_the_avatar_image
/// - key: JUICE
///   name: Juipter Icey Moon Explorer
///   color: "#ffea02"
///   avatar: your_url_to_the_avatar_image
/// ```
/// Note that only `key` is required. The key is usually in ALL CAPS but this is not required.
/// The key should match each person that speaks in the input chat log. Other properties for each
/// person can be custom to the specific template. For example, in the Discord template, `handle` is
/// not required and can be left off, while in the Twitter template, `handle` (if provided) sets the
/// handle that displays on the tweet.
pub fn load_config(config: &str) -> Result<Config, Box<dyn Error>> {
    let config: ConfigSchema = serde_yaml::from_str(config)?;
    let mut people = HashMap::new();

    for mut person in config.people {
        // Ensure that the User always has access to its own key.
        person
            .user
            .fields
            .insert("key".to_string(), person.key.clone());
        // Also ensure that a User always has a name. If no name is provided, default to the key.
        let _ = person
            .user
            .fields
            .try_insert("name".to_string(), person.key.clone());
        people.insert(person.key, person.user);
    }

    Ok(Config { people })
}
