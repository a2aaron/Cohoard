import * as cohoard from "https://static.witchoflight.com/~a2aaron/cohoard/v0.5.0/cohoard.js";
import { h, localStorageOrDefault, enumerate } from "./util.js";
import { render } from "./index.js";


/**
 * A DropdownName consists of any string starting with "builtin-" or "custom-" followed immediately
 * by a number. These are used by the template selector dropdown's `value` attributes, which
 * are the internal names of the templates.
 * @typedef {`builtin-${number}` | `custom-${number}`} DropdownName
 */

/**
 * @param {string} dropdown_value
 * @returns {dropdown_value is DropdownName}
 */
function is_dropdown_value(dropdown_value) {
    return dropdown_value.startsWith("builtin-") || dropdown_value.startsWith("custom-");
}

/**
 * @param {string} dropdown_value
 * @returns {dropdown_value is DropdownName}
 */
function is_custom(dropdown_value) {
    return dropdown_value.startsWith("custom-");
}

/**
 * @param {number} i the index of the template
 * @returns {DropdownName}
 */
function builtin_i(i) {
    return `builtin-${i}`;
}

/**
 * @param {number} i the index of the template
 * @returns {DropdownName}
 */
function custom_i(i) {
    return `custom-${i}`;
}

/**
 * A UIDescription is an object with a `name`, `label`, and `type` properties. The `name` and `label`
 * are strings. `type` is a string corresponding to an `<input>`'s `type` attribute (for example,
 * valid values include "text" and "checkbox"). This is used to describe what sort of UI element a
 * template wishes to include as a control for itself. UIDescriptions are transformed into UIElements
 * when being shown to the user.
 * @typedef {{
 *      name: string,
 *      type: "text" | "url" | "time" | "datetime" | "email" |
 *              "checkbox" | "radio" | "color" | "range" | "file",
 *      label: string,
 *      default?: string,
 *      placeholder?: string,
 * }} UIDescription
 */

/**
 * Returns true if `ui_desc` is a UIDescription.
 * @param {object} ui_desc
 * @returns {ui_desc is UIDescription}
 */
function is_ui_description(ui_desc) {
    if (Object.hasOwn(ui_desc, "name") &&
        Object.hasOwn(ui_desc, "type") &&
        Object.hasOwn(ui_desc, "label")) {
        return ["text", "url", "time", "datetime", "email",
            "checkbox", "radio", "color", "range", "file"]
            // @ts-ignore
            .includes(ui_desc.type);
    }
    return false;
}


/**
 * Manages the template preset UI
 */
export class TemplateControls {
    /**
     * @param {HTMLSelectElement} dropdown_element 
     * @param {HTMLTextAreaElement} template_area 
     * @param {HTMLButtonElement} edit_template_button
     * @param {HTMLButtonElement} delete_template_button
     * @param {HTMLButtonElement} rename_template_button
     * @param {HTMLElement} template_ui
     * @param {Array<Template>} builtin_templates
     * @param {Array<Template>} custom_templates
     */
    constructor(dropdown_element,
        template_area,
        edit_template_button,
        delete_template_button,
        rename_template_button,
        template_ui,
        builtin_templates,
        custom_templates) {
        this.dropdown = dropdown_element;
        this.template_area = template_area;
        this.edit_template_button = edit_template_button;
        this.delete_template_button = delete_template_button;
        this.rename_template_button = rename_template_button;
        this.template_ui = template_ui;
        this.builtin_templates = builtin_templates;
        this.custom_templates = custom_templates;

        // Event listener for re-rendering when changing the selected template via the dropdown.
        this.dropdown.addEventListener("input", async () => {
            if (this.dropdown.value == "new-preset") {
                this.add_new_preset()
            } else {
                this.set_current_template(this.get_current_dropdown());
            }

            this.#regenerate_ui();
            render();
        });

        // Event listener for re-rendering when editing the template.
        this.template_area.addEventListener("input", async () => {
            let dropdown_value = this.get_current_dropdown();
            if (is_dropdown_value(dropdown_value)) {
                let template = this.get_template(dropdown_value);
                if (template == null) {
                    console.warn(`couldn't get template ${dropdown_value}`);
                } else {
                    template.set_content(template_area.value);
                }

                // We regenerate the UI, since the UI-config might have changed.
                this.#regenerate_ui();
                render();
            }
        })

        // Event listener for the delete button
        this.delete_template_button.addEventListener("click", () => {
            let dropdown_value = this.get_current_dropdown();
            if (is_custom(dropdown_value)) {
                if (!confirm(`Are you sure you want to delete ${this.dropdown.selectedOptions[0].textContent}?`)) {
                    return;
                }

                // remove the value from the dropdown
                let dropdown_index = this.dropdown.selectedIndex;
                this.dropdown.remove(dropdown_index);

                // remove the value from the custom templates list
                let index = Number(dropdown_value.replace("custom-", ""));
                this.custom_templates.splice(index, 1);

                this.#renegerate_dropdown();
                if (index < this.custom_templates.length) {
                    this.set_current_template(custom_i(index));
                } else if (this.custom_templates.length != 0 && index != 0) {
                    this.set_current_template(custom_i(index - 1));
                } else if (is_dropdown_value(this.dropdown.value)) {
                    this.set_current_template(this.dropdown.value);
                } else {
                    this.set_current_template(builtin_i(0));
                }

                this.#regenerate_ui();
                render();
            }
        });

        // Event listener for the rename button
        this.rename_template_button.addEventListener("click", () => {
            let dropdown_value = this.get_current_dropdown();
            if (is_custom(dropdown_value)) {
                let old_name = this.dropdown.selectedOptions[0].textContent ?? "";
                let new_name = prompt(`Enter the new name for ${old_name}`, old_name);
                if (new_name == null || new_name.trim() == "") {
                    return;
                }
                new_name = new_name.trim();
                let template = this.get_template(dropdown_value);
                if (template == null) {
                    console.warn(`couldn't get template ${dropdown_value}`);
                } else {
                    template.displayed_name = new_name;
                }

                this.#renegerate_dropdown();
                save_custom_templates(this.custom_templates);
            }
        });

        // Event listener to save custom templates when leaving the page + every 5 seconds.
        window.addEventListener("beforeunload", () => save_custom_templates(this.custom_templates));
        window.setInterval(() => save_custom_templates(this.custom_templates), 5000);

        // Set up the dropdown nodes.
        this.#renegerate_dropdown();
        this.#regenerate_ui();

        // Set the current template to the first builtin template.
        this.set_current_template("builtin-0");
    }

    /**
     * Mount the TemplateControls to the given HTML elements. 
     * @param {HTMLSelectElement} template_dropdown the dropdown that presets will be located in.
     * @param {HTMLTextAreaElement} template_area the editable template window
     * @param {HTMLButtonElement} edit_template_button the "Edit Template" button
     * @param {HTMLButtonElement} delete_template_button the "Delete Template" button
     * @param {HTMLButtonElement} rename_template_button the "Rename Template" button
     * @param {HTMLElement} template_ui the area for the template UI controls.
     * @returns {Promise<TemplateControls>} 
     */
    static async mount(template_dropdown, template_area, edit_template_button, delete_template_button, rename_template_button, template_ui) {
        let builtin_templates = [DISCORD_BUILTIN, TWITTER_BUILTIN, PESTERLOG_BUILTIN, FOOTBALL_BUILTIN];
        let custom_templates = load_custom_templates();
        let template_controls = new TemplateControls(
            template_dropdown,
            template_area,
            edit_template_button,
            delete_template_button,
            rename_template_button,
            template_ui,
            builtin_templates, custom_templates);

        return template_controls;
    }

    /**
     * Add a new blank custom preset. This also sets the current template to the blank template.
     */
    add_new_preset() {
        let i = this.custom_templates.length;

        let new_template = Template.custom("Custom Template " + i, BASIC_TEMPLATE);
        this.custom_templates.push(new_template);

        this.#renegerate_dropdown();
        this.set_current_template(custom_i(i));
    }

    /**
     * Returns the template that has the name `dropdown_name`.
     * @param {DropdownName} dropdown_name the name of the template used by the dropdown selector
     * @returns {Template?} the Template that has the given name, if it exists
     */
    get_template(dropdown_name) {
        if (dropdown_name.startsWith("builtin")) {
            let index = Number(dropdown_name.replace("builtin-", ""));
            return this.builtin_templates[index] ?? null;
        } else if (dropdown_name.startsWith("custom")) {
            let index = Number(dropdown_name.replace("custom-", ""));
            return this.custom_templates[index] ?? null;
        } else {
            throw new Error(`expected dropdown_name to start with "builtin-" or "custom-", got ${dropdown_name}`);
        }
    }

    /**
     * Sets the given template as the current template. If the template does not exist, then this
     * function defaults to the first builtin template
     * @param {DropdownName} dropdown_name the name of the template used by the dropdown selector
     */
    set_current_template(dropdown_name) {
        this.dropdown.value = dropdown_name;
        let template = this.get_template(dropdown_name);
        if (template == null) {
            console.warn(`Couldn't get template ${dropdown_name}!`);
            template = this.builtin_templates[0];
        }

        this.template_area.readOnly = template.is_builtin;
        this.template_area.value = template.get_content();

        if (template.is_builtin) {
            this.edit_template_button.innerText = "View Template";
            this.delete_template_button.classList.add("hidden");
            this.rename_template_button.classList.add("hidden");
        } else {
            this.edit_template_button.innerText = "Edit Template";
            this.delete_template_button.classList.remove("hidden");
            this.rename_template_button.classList.remove("hidden");
        }
    }

    /**
     * Returns the currently selected template.
     * @returns {Template}
     */
    get_current_template() {
        let template = this.get_template(this.get_current_dropdown());
        if (template != null) {
            return template;
        } else {
            throw new Error(`Couldn't get template ${this.get_current_dropdown()}?`);
        }
    }

    /**
     * Return the current value of the dropdown selection.
     * @returns {DropdownName}
     */
    get_current_dropdown() {
        let dropdown_value = this.dropdown.value;
        if (is_dropdown_value(dropdown_value)) {
            return dropdown_value;
        } else {
            throw new Error(`Currently selected dropdown value ${dropdown_value} is not a Dropdownname!`);
        }
    }

    /**
     * Regenerate the template selector dropdown. This should be called whenever the list of available templates is modified.
     */
    #renegerate_dropdown() {
        // Get the current dropdown value. Regenerating the dropdown will reset the current selection
        // back to the first option in the list, so we will need to restore it.
        let last_dropdown_value = this.dropdown.value;

        let builtin_group = h("optgroup", { label: "Builtin Templates" });
        for (let [i, template] of enumerate(this.builtin_templates)) {
            builtin_group.appendChild(template.get_html_node(builtin_i(i)));
        }

        let custom_group = h("optgroup", { label: "Custom Templates" });
        for (let [i, template] of enumerate(this.custom_templates)) {
            custom_group.appendChild(template.get_html_node(custom_i(i)));
        }

        let new_preset = option("new-preset", "Create New Preset...");

        this.dropdown.replaceChildren(builtin_group, custom_group, new_preset);

        // Restore the user's previously selected template.
        if (is_dropdown_value(last_dropdown_value)) {
            this.set_current_template(last_dropdown_value);
        }
    }

    /**
     * Regenerate the UI HTML elements. 
     */
    #regenerate_ui() {
        const ui_elements = this.get_current_template().get_ui_elements();
        let html_nodes = /** @type {Array<HTMLElement>} */ ([]);
        for (const [name, ui_element] of Object.entries(ui_elements)) {
            html_nodes.push(ui_element.get_html_element());
        }
        this.template_ui.replaceChildren(...html_nodes);
    }
}

/**
 * Save the custom templates to localStorage.
 * @param {Array<Template>} templates the templates to save
 */
function save_custom_templates(templates) {
    let saved_templates = templates.map((template) => {
        return {
            content: template.get_content(),
            displayed_name: template.displayed_name,
        }
    })
    localStorage.setItem("customTemplates", JSON.stringify(saved_templates));
}

/**
 * Load custom templates from localStorage. If this fails, returns an empty array.
 * @returns {Array<Template>} the saved custom templates
 */
function load_custom_templates() {
    try {
        let stored_templates = localStorageOrDefault("customTemplates", []);
        if (!(Array.isArray(stored_templates))) {
            console.warn("stored template data wasn't an array!", stored_templates);
            return [];
        }

        // The objects from localStorage are just bare objects--not actually the class, so we need
        // to explicitly construct Templates.
        let templates = [];
        for (let [i, template] of enumerate(stored_templates)) {
            let real_template = Template.custom(template.displayed_name, template.content);
            templates.push(real_template);
        }
        return templates;
    } catch (err) {
        console.warn("Couldn't load saved templates! Reason: ", err);
        return [];
    }
}

/** 
 * A class containing the contents and other information about a template. This also stores the
 * template's UI HTMLElements.
 */
class Template {
    /** The text content of the Template. 
     * @type {string} */
    #content;
    /** The UIElements associated with this template. 
     * @type {UIElements} */
    #ui_elements;

    /**
     * @param {string} displayed_name the displayed name of the template
     * @param {boolean} is_builtin true if the template is builtin
     * @param {string} content the contents of the template (if not builtin)
     */
    constructor(displayed_name, content, is_builtin) {
        this.displayed_name = displayed_name;
        this.is_builtin = is_builtin;
        this.#content = content;
        let [elements, errors] = parse_ui_description(content);
        this.#ui_elements = elements;
        this.ui_errors = errors;
    }

    /**
     * @param {cohoard.Config} cohoard_config
     * @param {string} script
     * @returns {string | Error}
     */
    render(cohoard_config, script) {
        let posts = cohoard.parse_posts(cohoard_config, script);

        try {
            return cohoard.render("template", this.get_content(), posts, cohoard_config, this.get_ui_values());
        } catch (err) {
            return /** @type {Error} */ (err);
        }

    }

    /**
     * Return a dropdown selection with the information of the template.
     * @param {string} value the value for the dropdown selection.
     * @returns {HTMLOptionElement}
     */
    get_html_node(value) {
        return option(value, this.displayed_name);
    }

    /**
     * Returns the HTML elements of the UI. If there are no elements or the UI config couldn't be parsed,
     * this array is empty.
     * @returns {UIElements}
     */
    get_ui_elements() {
        return this.#ui_elements;
    }

    /**
     * Returns the current values of the UIs. The keys of the returned object correspond to the 
     * variable name the value is for.
     * @returns {{[key: string]: string | boolean}}
     */
    get_ui_values() {
        let values = /** @type {{[key: string]: string | boolean}} */ ({});
        for (const [name, element] of Object.entries(this.#ui_elements)) {
            values[name] = element.get_value();
        }
        return values;
    }

    /**
     * Get the template's contents
     * @returns {string}
     */
    get_content() {
        return this.#content;
    }

    /**
     * Set the template's contents. This also parses for UI configs and will re-generate the existing
     * ui_elements (so subseqeuent calls to `get_ui_elements` will no longer point to the same nodes).
     * TODO: Doing this also clobbers the currently selected values for the UI elements, which we should avoid doing.
     * @param {string} new_content 
     */
    set_content(new_content) {
        this.#content = new_content;
        let [new_elements, maybe_error] = parse_ui_description(new_content);

        for (const [name, old_element] of Object.entries(this.#ui_elements)) {
            // If the new element would have the same name and type as the old element, use the old
            // elements's previous value, so that we do not clobber it.
            if (new_elements[name] && UIElement.equals(new_elements[name], old_element)) {
                new_elements[name].set_value(old_element.get_value());
            }
        }

        this.#ui_elements = new_elements;
        this.ui_errors = maybe_error;
    }

    /**
     * Create a builtin template. The contents are fetched from the given URL.
     * @param {string} displayed_name the displayed name of the template
     * @param {string} url the url to get the template from
     * @returns {Promise<Template>}
     */
    static async builtin(displayed_name, url) {
        let content = await get_template_from_url(url) ?? "Couldn't fetch template!";
        return new Template(displayed_name, content, true);
    }

    /**
     * Create a custom template with the given contents.
     * @param {string} displayed_name the displayed name of the template
     * @param {string} content the initial contents of the template
     * @returns {Template} 
     */
    static custom(displayed_name, content) {
        return new Template(displayed_name, content, false);
    }
}

/**
 * Attempts to parse the UI description in the template contents. If it cannot, returns an empty array.
 * This attempts to find a comment within the template similar to the schema below:
 * {#-config
 * [{
 *      "name": "light_mode",
 *      "type": "boolean",
 *      "label": "Use Light Mode",
 *  }, {
 *      "name": "background_color",
 *      "type": "string",
 *      "label": "Custom Background Color",
 *  },
 * ]
 * config-#}
 * This format is, specifically, a JSON string containing an array of UIDescriptions.
 * @param {string} content 
 * @returns {[UIElements, Array<Error>]} A dictionary whose keys are each UIDescription's "name" field and
 * the values are the corresponding UIElement
 */
function parse_ui_description(content) {
    // Match anything between "{#-config" and "config-#}"
    const regexp = /{#-config(.+?)config-#}/gs;
    const matches = content.matchAll(regexp);

    let elements = /** @type {UIElements} */ ({});
    let errors = [];

    for (const match of matches) {
        // Try to access the first capture group. Otherwise, skip this match because it's malformed.
        if (match.length < 2) {
            continue;
        }

        let json_text = match[1];

        // Try to parse the text as a JSON array.
        let json_arr;
        try {
            json_arr = JSON.parse(json_text);
        } catch (err) {
            if (err instanceof SyntaxError) {
                errors.push(new Error(`Unable to parse config block ${json_text}`, { cause: err }));
            }
            continue;
        }

        if (!(json_arr instanceof Array)) {
            errors.push(new Error(`Expected ${json_text} to be JSON blob containing an array. Got ${json_arr} instead.`));
            continue;
        }

        // Finally, parse the UI descriptions and add them to the dictionary.
        for (let ui_desc of json_arr) {
            if (is_ui_description(ui_desc)) {
                elements[ui_desc.name] = new UIElement(ui_desc);
            } else {
                errors.push(new Error(`Expected ${ui_desc} to be a UIDescription!`));
            }
        }
    }

    return [elements, errors];
}

/**
 * Wraps an HTMLElement containing an input element and a lable. The input element's type is determined
 * by the given UIDescription's type. The label's contents are determined by the UIDescription's label field
 * 
 * @typedef {{[key: string]: UIElement}} UIElements
 */
class UIElement {
    /** The public consumable UI element, containing both the input and the label.
     * @type {HTMLElement} */
    #html_element;
    /** @type {HTMLInputElement} */
    #input_element
    /**
     * @param {UIDescription} ui_description the UIDescription for this element. This determines the
     * contents of the input and label. Specifically:
     * - the `type` attribute of the `<input>` will be `ui_description.type`
     * - the `id` attribute of the `<input>` will be `template-ui-${ui_description.name}`
     * * - the `for` attribute of the `<label>` will be `template-ui-${ui_description.name}`
     * - the inital `value` of the `<input>` will be `ui_description.default`, if provided
     * - the `placeholder` attribute of the `<input>` will be `ui_description.placeholder`, if provided
     * - the body of the `<label>` will be `ui_description.label`
     */
    constructor(ui_description) {
        const label = `template-ui-${ui_description.name}`;

        //@ts-ignore
        this.#input_element = h("input", { type: ui_description.type, id: label });
        if (ui_description.default) {
            if (ui_description.type == "checkbox") {
                this.#input_element.checked = ui_description.default === "true";
            } else {
                this.#input_element.value = ui_description.default;
            }
        }

        if (ui_description.placeholder) {
            this.#input_element.placeholder = ui_description.placeholder;
        }

        // Rerender whenever this UI object is changed.
        this.#input_element.addEventListener("input", () => render())

        // Set innerHTML instead of passing the UI description label as a string into the body array
        // above. This is done so that HTML inside the UI description label will turn into actual
        // HTML and not text.
        let label_element = h("label", { for: label }, []);
        label_element.innerHTML = ui_description.label;

        this.#html_element = h("div", { class: "template-ui-element gap-1" }, [label_element, this.#input_element]);


        this.ui_description = ui_description;
    }

    /**
     * Returns true if the given UIElements match in type and name.
     * @param {UIElement} a
     * @param {UIElement} b 
     * @returns 
     */
    static equals(a, b) {
        return a.ui_description.type == b.ui_description.type && a.ui_description.name == b.ui_description.name;
    }

    /**
     * Return the HTMLElement containing the UI.
     * @returns {HTMLElement}
     */
    get_html_element() {
        return this.#html_element;
    }

    /**
     * Set the current value of the UI element
     * @param {boolean | string} value
     */
    set_value(value) {
        if (typeof value == "boolean") {
            this.#input_element.checked = value;
        } else {
            this.#input_element.value = value;
        }
    }

    /**
     * @returns {string | boolean}
     */
    get_value() {
        if (this.ui_description.type == "checkbox") {
            return this.#input_element.checked;
        } else {
            return this.#input_element.value;
        }
    }
}

/**
 * Returns an `<option>` tag with the `value` attribute set to `value` and the given `body`.
 * @param {string} value the value of the value attribute
 * @param {string} body the body of the option tag
 * @returns {HTMLOptionElement}
 */
function option(value, body) {
    let element = h("option", { value }, body);
    return /** @type {HTMLOptionElement} */ (element);
}

/**
 * Returns a Tera template from the given URL.
 * @param {string} url the URL to fetch from
 * @returns {Promise<string | null>} the contents of the template 
 */
async function get_template_from_url(url) {
    let text = await fetch(url).then(response => {
        return response.text()
    }).catch(err => {
        console.warn(`Couldn't fetch from ${url}`);
        console.warn(err);
        return null;
    });
    return text;
}

export const DISCORD_BUILTIN = await Template.builtin("Discord", "https://raw.githubusercontent.com/a2aaron/Cohoard/canon/templates/discord.html");
export const TWITTER_BUILTIN = await Template.builtin("Twitter", "https://raw.githubusercontent.com/a2aaron/Cohoard/canon/templates/twitter.html");
export const FOOTBALL_BUILTIN = await Template.builtin("17776", "https://raw.githubusercontent.com/a2aaron/Cohoard/canon/templates/17776.html");
export const PESTERLOG_BUILTIN = await Template.builtin("Pesterlog", "https://raw.githubusercontent.com/a2aaron/Cohoard/canon/templates/homestuck.html");


export const BASIC_TEMPLATE = await get_template_from_url("https://raw.githubusercontent.com/a2aaron/Cohoard/canon/templates/basic.html") ?? "Couldn't fetch template!";
