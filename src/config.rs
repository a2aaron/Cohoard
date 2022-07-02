use std::{collections::HashMap, error::Error, path::Path};

use serde::Deserialize;

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

#[derive(Debug, Clone)]
pub struct Config {
    pub people: HashMap<String, User>,
}

pub fn load_config(path: impl AsRef<Path>) -> Result<Config, Box<dyn Error>> {
    let mut people = HashMap::new();
    let config = std::fs::read(path)?;
    let config: ConfigSchema = serde_yaml::from_slice(&config)?;

    for person in config.people {
        people.insert(person.key, person.user);
    }

    Ok(Config { people })
}
