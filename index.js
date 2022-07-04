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

let config_error_msg = document.getElementById("config-error-msg");
let render_error_msg = document.getElementById("render-error-msg");

let config;

let response = await fetch(template_dropdown.value);
let template = await response.text();

/** Constructs HTML elements
* @param {string} tag - The tag of the HTML element
* @param {object} attrs -A dictionary of the attributes of the element
* whose keys are the attribute names and the values are the attribute values.
* Note that the "value" key (a key whose name is literally "value") is
* special--this sets the `node.value` property instead of setting an attribute.
* @param {string | HTMLElement | Array<string | HTMLElement>} [body] - The body of the HTML element.
* @returns {HTMLElement} - The constructed HTML element
* You can recursively call `h` to achieve nested objects.
* Example:
* ```javascript
* h("div", { class: "foo" }, [
*   h("h1", { id: "bar" }, "Hello!"),
*   h("p", {}, "World!"),
* ])
* ```
* This produces the following HTML
* ```html
* <div class="foo">
*    <h1 id="bar">Hello!</h1>
*    <p>World!<p>
* </div>
* ```
*/
function h(tag, attrs, body) {
   const element = document.createElement(tag);
   for (const [k, v] of Object.entries(attrs)) {
      // Special-case the value and have it set the actual node value
      if (k == "value") {
         element.value = v;
      } else {
         element.setAttribute(k, v);
      }
   }

   if (body == undefined) {

   } else if (Array.isArray(body)) {
      element.append(...body);
   } else {
      element.append(body);
   }
   return element;
}

/**
 * Return a `td` or `th` cell containing a text input.
 * @param {"td" | "th"} td_or_th - Determines whether if the cell is a data or header cell.
 * @param {string} value - The initial text of the text input
 * @param {string} placeholder - The placeholder text for the text input
 * @returns {HTMLElement} - The table cell containing the text input
 * The specific HTML returned looks like this:
 * ```html
 * <td>
 *     <input type="text">value</input>
 * </td>
 * ```
 */
function td_input(td_or_th, value, placeholder) {
   return h(td_or_th, {},
      h("input", { type: "text", placeholder, value })
   );
}

/**
 * Generates a `<table>` of the config data
 * @param {Array<string>} keys The columns headers that will be generated
 * @param {int} num_people The number of rows to generate
 * @returns {HTMLElement} The generated `table`.
 */
function make_config_table(keys, num_people) {
   let table = document.createElement("table");

   let header_row = document.createElement("tr");
   header_row.setAttribute("class", "config-row-header");
   for (const key of keys) {
      let cell;
      if (key == "key") {
         cell = h("th", {}, key);
      } else {
         cell = td_input("th", key, "key name");
      }

      header_row.appendChild(cell);
   }

   table.appendChild(header_row);

   for (const x of Array(num_people).keys()) {
      let row = document.createElement("tr");
      for (const key of keys) {
         row.appendChild(td_input("td", "", key));
      }
      table.appendChild(row);
   }

   return table;
}

/**
 * @param {any} object 
 * @param {string} name The HTML element name to check for
 * @returns {bool} Returns true if `object` is an HTML element with the given name
 */
function is_html_node(object, name) {
   return object.tagName.toLowerCase() == name.toLowerCase();
}

function config_from_table(table) {
   assert(is_html_node(cell, "table"));
   let keys = [];
   for (let cell of table.rows[0]) {
      let textarea = cell.get
      assert(is_html_node(cell, "tr"));
      keys.push(cell.value);
   }

   let people = [];
   for (let row of table.rows) {
      for (let cell of row) {

      }
   }
}

let config_div = document.getElementById("config");
config_div.appendChild(make_config_table(["key", "name", "handle", "color", "avatar", "email"], 10));

/**
 * Load and set the current config 
 */
function load_config() {
   try {
      // TODO
      config_error_msg.innerText = "TODO - load_config()";
   } catch (err) {
      config_error_msg.innerText = err;
   }
}

// Render the chat log to the preview/HTML areas using the
// currently selected template.
function render() {
   if (config == null) {
      return;
   }
   let posts = cohoard.parse_posts(config, script_textarea.value);

   try {
      let rendered = cohoard.render("discord template", template, posts);
      preview_area.innerHTML = rendered;
      html_area.value = rendered;

      render_error_msg.innerText = "";
   } catch (err) {
      render_error_msg.innerText = err;
   }
}

script_textarea.addEventListener("input", render)

config_textarea.addEventListener("input", () => {
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

load_config();
render();