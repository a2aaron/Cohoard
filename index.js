import init, * as cohoard_module from "https://static.witchoflight.com/~a2aaron/cohoard/v0.5.0/cohoard.js";

import { ConfigTable } from "./config_table.js"
import { TemplateControls, DISCORD_BUILTIN } from "./template_controls.js";
import { getTypedElementById, localStorageOrDefault, render_error_messages, set_error_message, unset_error_message } from "./util.js";
import { PRESETS } from "./presets.js"

/** @type {typeof cohoard_module?} */
let cohoard = null;

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

   let cohoard_config = config_table.cohoard_config;
   let template_contents = template_controls.get_current_template().get_content();
   let template_ui_values = template_controls.get_current_template().get_ui_values();

   try {
      let posts = cohoard.parse_posts(cohoard_config, script_textarea.value);
      let rendered = cohoard.render("template", template_contents, posts, cohoard_config, template_ui_values);
      preview_area.innerHTML = rendered;
      html_area.value = rendered;
      unset_error_message("render", template_controls.get_current_dropdown());
      config_table.unmark_errs();
   } catch (err) {
      let the_err = /** @type {Error} */ (err);
      console.error("Failed to render template\n", the_err);
      // Try to parse the error message into something useful
      let missing_var = parse_as_missing_variable(the_err.message);
      if (missing_var) {
         const field = parse_as_missing_field(missing_var);
         if (field) {
            // Try to highlight the missing field in the config table.
            config_table.unmark_errs();
            const is_key_in_table = config_table.mark_err(field);
            if (is_key_in_table) {
               set_error_message(new Error(`Field "${field}" is missing from a row in the Config Table`, { cause: the_err }), "render", template_controls.get_current_dropdown());
            } else {
               set_error_message(new Error(`Couldn't find a field named "${field}" (Maybe you need to add it to the Config Table?)`, { cause: the_err }), "render", template_controls.get_current_dropdown());
            }
         } else {
            set_error_message(new Error(`Invalid variable "${missing_var}"`, { cause: the_err }), "render", template_controls.get_current_dropdown());
         }
      } else {
         set_error_message(the_err, "render", template_controls.get_current_dropdown());
      }
   }

   render_error_messages(template_controls.get_current_dropdown());
}

// The config object that the Cohoard Rust library uses.
/** @type {cohoard_module.Config?} */
let COHOARD_CONFIG = null;

// Get HTML elements that are part of the UI.

let script_textarea = getTypedElementById(HTMLTextAreaElement, "script");

let config_div = getTypedElementById(HTMLDivElement, "config-wrapper");
let config_table = ConfigTable.mount(config_div, ["key", "name", "color", "avatar", "handle"], 10);
let cleanup_button = getTypedElementById(HTMLButtonElement, "cleanup-btn")
let add_person_dropdown = getTypedElementById(HTMLSelectElement, "add-person-select");
add_person_dropdown.value = "add-row";

let preview_area = getTypedElementById(HTMLDivElement, "preview-output");
let html_area = getTypedElementById(HTMLTextAreaElement, "html-output");

let template_area = getTypedElementById(HTMLTextAreaElement, "template-editor");
let template_dropdown = getTypedElementById(HTMLSelectElement, "template-select");
let edit_template_button = getTypedElementById(HTMLButtonElement, "edit-template-btn");
let delete_template_button = getTypedElementById(HTMLButtonElement, "delete-template-btn");
let rename_template_button = getTypedElementById(HTMLButtonElement, "rename-template-btn");
let template_ui = getTypedElementById(HTMLElement, "template-ui");
let template_controls = await TemplateControls.mount(template_dropdown, template_area, edit_template_button, delete_template_button, rename_template_button, template_ui);

let preview_button = getTypedElementById(HTMLButtonElement, "preview-btn");
let html_button = getTypedElementById(HTMLButtonElement, "html-btn");

// Set up event listeners.

script_textarea.addEventListener("input", () => {
   localStorage.setItem("script", script_textarea.value);
   render();
});

cleanup_button.addEventListener("click", () => {
   config_table.remove_empty_rows_and_columns();
});

preview_button.addEventListener("click", () => {
   preview_area.classList.remove("hidden");
   html_area.classList.add("hidden");
   template_area.classList.add("hidden");
});

html_button.addEventListener("click", () => {
   preview_area.classList.add("hidden");
   html_area.classList.remove("hidden");
   template_area.classList.add("hidden");
});

edit_template_button.addEventListener("click", () => {
   preview_area.classList.add("hidden");
   html_area.classList.add("hidden");
   template_area.classList.remove("hidden");
});

add_person_dropdown.addEventListener("input", () => {
   let preset_name = add_person_dropdown.value;

   let preset;
   if (preset_name == "cohost-random") {
      let random_int = Math.floor(Math.random() * 1000000);
      preset = {
         key: "CHOSTER",
         name: "Choster",
         avatar: `https://cohost.org/rc/default-avatar/${random_int}.png`,
      };
   } else {
      preset = PRESETS[preset_name];
   }
   if (preset) {
      config_table.append_row(preset);
   } else {
      console.error(`missing preset name: ${preset_name}`);
   }

   add_person_dropdown.value = "add-row";
   render();
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
      people: [PRESETS["cohost-eggbug"], PRESETS["cohost-bugegg"]]
   });

   let cohoard_config = cohoard.load_config(config_json);

   let posts = cohoard.parse_posts(cohoard_config, discord_example_script.innerText);
   let rendered = cohoard.render("template", DISCORD_BUILTIN.get_content(), posts, cohoard_config, {});
   discord_example_div.innerHTML = rendered;
   // Remove the negative margin on the rendered post.
   // @ts-ignore
   discord_example_div.firstChild.style.margin = "auto";
}

let saved_script = localStorage.getItem("script");
if (saved_script != null) {
   script_textarea.value = saved_script;
}


// Load cohoard library.
try {
   await init();
} catch (err) {
   console.error("oh god oh fuck we couldn't load cohoard ", err);
   preview_area.innerHTML = "Something broke, we couldn't load Cohoard :(";
   // @ts-ignore
   set_error_message(err, "init", "ALL");
}

cohoard = cohoard_module;

function after_cohoard_load() {
   render();
   render_examples();
}

after_cohoard_load();

