import init, * as cohoard from "https://static.witchoflight.com/~a2aaron/cohoard-0.1.0/cohoard.js";

await init();

// Fetch the Tera template at the given URL.
async function get_template(url) {
   let response = await fetch(url);
   let template = await response.text();
   return template;
}

let script_textarea = document.getElementById("script");
let config_textarea = document.getElementById("config");
let preview_area = document.getElementById("preview-output");
let html_area = document.getElementById("html-output");
let template_dropdown = document.getElementById("template-select");

let preview_button = document.getElementById("preview-btn");
let html_button = document.getElementById("html-btn");

let config = cohoard.load_config(config_textarea.value);

let response = await fetch(template_dropdown.value);
let template = await response.text();

// Render the chat log to the preview/HTML areas using the
// currently selected template.
function render() {
   let posts = cohoard.parse_posts(config, script_textarea.value);

   let rendered = cohoard.render("discord template", template, posts);
   preview_area.innerHTML = rendered;
   html_area.value = rendered;
}

script_textarea.addEventListener("input", render)

config_textarea.addEventListener("input", () => {
   config = cohoard.load_config(config_textarea.value);
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

render();