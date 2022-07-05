import init, * as cohoard from "https://static.witchoflight.com/~a2aaron/cohoard/0.2.0/cohoard.js";

import { ConfigTable } from "./config_table.js"

await init();

// Fetch the Tera template at the given URL.
async function get_template(url) {
   let response = await fetch(url);
   let template = await response.text();
   return template;
}

/**
 * Load and set the current config 
 */
function load_config() {
   config_table.save_table();
   try {
      COHOARD_CONFIG = config_table.cohoard_config;
      config_error_msg.innerText = "";
   } catch (err) {
      config_error_msg.innerText = err;
      console.error(err);
   }
}

// Render the chat log to the preview/HTML areas using the
// currently selected template.
function render() {
   if (COHOARD_CONFIG == null) {
      return;
   }
   let posts = cohoard.parse_posts(COHOARD_CONFIG, script_textarea.value);

   try {
      let rendered = cohoard.render("template", template, posts);
      preview_area.innerHTML = rendered;
      html_area.value = rendered;

      render_error_msg.innerText = "";
   } catch (err) {
      render_error_msg.innerText = err;
      console.error(err);
   }
}

// The config object that the Cohoard Rust library uses.
let COHOARD_CONFIG;

// Get HTML elements that are part of the UI.

let script_textarea = document.getElementById("script");

let config_div = document.getElementById("config-wrapper");
let config_table = ConfigTable.mount(config_div, ["key", "name", "color", "avatar", "handle"], 10);

let preview_area = document.getElementById("preview-output");
let html_area = document.getElementById("html-output");
let template_dropdown = document.getElementById("template-select");

let preview_button = document.getElementById("preview-btn");
let html_button = document.getElementById("html-btn");

let config_error_msg = document.getElementById("config-error-msg");
let render_error_msg = document.getElementById("render-error-msg");

let response = await fetch(template_dropdown.value);
let template = await response.text();

// Set up event listeners.

script_textarea.addEventListener("input", render)

config_div.addEventListener("input", () => {
   load_config();
   render();
})

preview_button.addEventListener("click", () => {
   preview_area.classList.remove("hidden");
   html_area.classList.add("hidden");
})

html_button.addEventListener("click", () => {
   preview_area.classList.add("hidden");
   html_area.classList.remove("hidden");
})

template_dropdown.addEventListener("input", async () => {
   template = await get_template(template_dropdown.value);
   render();
})

// Initial load -- load the config and render the script
load_config();
render();