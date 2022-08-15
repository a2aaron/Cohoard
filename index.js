import init, * as cohoard_module from "https://static.witchoflight.com/~a2aaron/cohoard/v0.5.0/cohoard.js";

import { ConfigTable } from "./config_table.js"
import { TemplateControls, DISCORD_BUILTIN } from "./template_controls.js";
import { getTypedElementById, render_error_messages, try_parse_tera_error } from "./util.js";
import { PRESETS } from "./presets.js"

/** @type {typeof cohoard_module?} */
let cohoard = null;

// Render the chat log to the preview/HTML areas using the
// currently selected template.
export function render() {
   if (cohoard == null) {
      console.info("Can't render - cohoard module not loaded");
      return;
   }

   let html_output = template_controls.get_current_template().render(config_table.cohoard_config, script_textarea.value);
   let errors = [];

   if (typeof (html_output) === "string") {
      preview_area.innerHTML = html_output;
      html_area.value = html_output;
   } else {
      config_table.unmark_errs(); let [err, bad_column] = try_parse_tera_error(html_output, config_table);
      if (bad_column) {
         config_table.unmark_errs();
         config_table.mark_err(bad_column);
      }
      console.error("Failed to render template\n", err);
      errors.push(err);
   }

   errors = errors.concat(template_controls.get_current_template().ui_errors);
   render_error_messages(...errors);
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

