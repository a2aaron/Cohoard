import init, * as cohoard from "https://static.witchoflight.com/~a2aaron/cohoard/0.2.0/cohoard.js";

import { ConfigTable } from "./config_table.js"
import { TemplateControls, DISCORD_BUILTIN } from "./template_controls.js";
import { getTypedElementById } from "./util.js";

/** @type {typeof cohoard_module?} */
let cohoard = null;

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

/**
 * Attempt to parse an error message as a Tera error messages. Tera error messages are of the format
 * "Variable `variable_name` not found while rendering 'template_name'"
 * This function attempts to extract `variable_name` from the message.
 * @param {string} err_msg the error message
 * @returns {string?} the missing variable
 */
function parse_as_missing_variable(err_msg) {
   const regexp = /Variable `([^`]*)` not found in context while rendering /;
   const matches = err_msg.match(regexp);
   if (matches == null) {
      return null;
   } else {
      return matches[1];
   }
}

/**
 * Attempts to determine if a Tera variable name represents a missing field. These are generally of 
 * the form "post.user.field_name", however, `post` could technically be any variable. This function
 * attempts to exact `field_name` from the variable name.
 * @param {string} tera_var_name 
 * @returns {string?} the field name
 */
function parse_as_missing_field(tera_var_name) {
   const arr = tera_var_name.split(".");
   if (arr.length == 3 && arr[1] == "user") {
      return arr[2];
   } else {
      return null;
   }
}

// Render the chat log to the preview/HTML areas using the
// currently selected template.
export function render() {
   if (cohoard == null) {
      console.info("Can't render - cohoard module not loaded");
      return;
   }

   if (COHOARD_CONFIG == null) {
      console.info("Can't render - Cohoard config is null");
      return;
   }
   console.info("rendering...");
   let posts = cohoard.parse_posts(COHOARD_CONFIG, script_textarea.value);

   try {
      let rendered = cohoard.render("template", template_area.value, posts);
      preview_area.innerHTML = rendered;
      html_area.value = rendered;

      config_table.unmark_errs();

      render_error_msg.innerText = "";
   } catch (err) {
      let the_err = /** @type {Error} */ (err);
      // @ts-ignore
      console.error("Failed to render template", the_err);
      // Try to parse the error message into something useful
      let missing_var = parse_as_missing_variable(the_err.message);
      if (missing_var) {
         const field = parse_as_missing_field(missing_var);
         if (field) {
            // Try to highlight the missing field in the config table.
            config_table.unmark_errs();
            const is_key_in_table = config_table.mark_err(field);
            if (is_key_in_table) {
               render_error_msg.innerText = `Field "${field}" is missing from a row in the Config Table`;
            } else {
               render_error_msg.innerText = `Couldn't find a field named "${field}" (Maybe you need to add it to the Config Table?)`;
            }
         } else {
            render_error_msg.innerText = `Invalid variable "${missing_var}"`;
         }
      } else {
         render_error_msg.innerText = the_err.message;
      }
   }
}

// The config object that the Cohoard Rust library uses.
/** @type {cohoard_module.Config?} */
let COHOARD_CONFIG = null;

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

// Render the examples in the quick start guide
function render_examples() {
   if (cohoard == null) {
      console.error("Can't render examples - cohoard module was not loaded");
      return;
   }

   let discord_example_script = getTypedElementById(HTMLPreElement, "discord-example-script");
   let discord_example_div = getTypedElementById(HTMLDivElement, "discord-example-render");

   let config_json = JSON.stringify({
      people: [{
         key: "EGGBUG",
         name: "egg bug!",
         color: "#83254f",
         avatar: "https://i.imgur.com/BBaogem.png"
      },
      {
         key: "BUGEGG",
         name: "bug egg!",
         color: "#258359",
         avatar: "https://i.imgur.com/BAFNmyY.png",
      }]
   });

   let cohoard_config = cohoard.load_config(config_json);

   let posts = cohoard.parse_posts(cohoard_config, discord_example_script.innerText);
   let rendered = cohoard.render("template", DISCORD_BUILTIN.content ?? "Couldn't load Discord template", posts);
   discord_example_div.innerHTML = rendered;
   // Remove the negative margin on the rendered post.
   // @ts-ignore
   discord_example_div.firstChild.style.margin = "auto";
}

function after_cohoard_load() {
   load_config();
   render();
   render_examples()
}


await init();
cohoard = cohoard_module;

after_cohoard_load();