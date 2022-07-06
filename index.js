import init, * as cohoard from "https://static.witchoflight.com/~a2aaron/cohoard/0.2.0/cohoard.js";

import { ConfigTable } from "./config_table.js"
import { TemplateControls } from "./template_controls.js";
import { getTypedElementById } from "./util.js";

await init();

/**
 * Load and set the current config 
 */
function load_config() {
   config_table.save_table();
   try {
      COHOARD_CONFIG = config_table.cohoard_config;
      config_error_msg.innerText = "";
   } catch (err) {
      // @ts-ignore
      config_error_msg.innerText = err;
      console.error(err);
   }
}

// Render the chat log to the preview/HTML areas using the
// currently selected template.
export function render() {
   if (COHOARD_CONFIG == null) {
      return;
   }
   console.info("rendering...");
   let posts = cohoard.parse_posts(COHOARD_CONFIG, script_textarea.value);

   try {
      let rendered = cohoard.render("template", template_area.value, posts);
      preview_area.innerHTML = rendered;
      html_area.value = rendered;

      render_error_msg.innerText = "";
   } catch (err) {
      // @ts-ignore
      render_error_msg.innerText = err;
      console.error(err);
   }
}

// The config object that the Cohoard Rust library uses.
/** @type {cohoard.Config} */
let COHOARD_CONFIG;

// Get HTML elements that are part of the UI.

let script_textarea = getTypedElementById(HTMLTextAreaElement, "script");

let config_div = getTypedElementById(HTMLDivElement, "config-wrapper");
let config_table = ConfigTable.mount(config_div, ["key", "name", "color", "avatar", "handle"], 10);

let preview_area = getTypedElementById(HTMLDivElement, "preview-output");
let html_area = getTypedElementById(HTMLTextAreaElement, "html-output");

let template_area = getTypedElementById(HTMLTextAreaElement, "template-editor");
let template_dropdown = getTypedElementById(HTMLSelectElement, "template-select");
let edit_template_button = getTypedElementById(HTMLButtonElement, "edit-template-btn");
let delete_template_button = getTypedElementById(HTMLButtonElement, "delete-template-btn");
let rename_template_button = getTypedElementById(HTMLButtonElement, "rename-template-btn");
let template_controls = await TemplateControls.mount(template_dropdown, template_area, edit_template_button, delete_template_button, rename_template_button);

let preview_button = getTypedElementById(HTMLButtonElement, "preview-btn");
let html_button = getTypedElementById(HTMLButtonElement, "html-btn");

let config_error_msg = getTypedElementById(HTMLDivElement, "config-error-msg");
let render_error_msg = getTypedElementById(HTMLDivElement, "render-error-msg");

// Set up event listeners.

script_textarea.addEventListener("input", render)

config_div.addEventListener("input", () => {
   load_config();
   render();
})

preview_button.addEventListener("click", () => {
   preview_area.classList.remove("hidden");
   html_area.classList.add("hidden");
   template_area.classList.add("hidden");
})

html_button.addEventListener("click", () => {
   preview_area.classList.add("hidden");
   html_area.classList.remove("hidden");
   template_area.classList.add("hidden");
})

edit_template_button.addEventListener("click", () => {
   preview_area.classList.add("hidden");
   html_area.classList.add("hidden");
   template_area.classList.remove("hidden");
})

// Initial load -- load the config and render the script
load_config();
render();