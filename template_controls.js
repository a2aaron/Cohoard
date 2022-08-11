import { h, localStorageOrDefault, enumerate, assert_html_node } from "./util.js";
import { render } from "./index.js";


/**
 * @typedef {`builtin-${number}` | `custom-${number}`} DropdownName
 * @typedef {{
 *      "name": string,
 *      "type": "text" | "url" | "time" | "datetime" | "email" |
 *              "checkbox" | "radio" | "color" | "range" | "file",
 *      "label": string,
 * }} UIDescription
 */

/**
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
     * @param {HTMLDivElement} template_ui
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

        // Event listener for re-rendering when changing the dropdown
        this.dropdown.addEventListener("input", async () => {
            if (this.dropdown.value == "new-preset") {
                this.add_new_preset()
            } else if (is_dropdown_value(this.dropdown.value)) {
                this.set_current_template(this.dropdown.value);
            }

            this.regenerate_ui();
            render();
        });

        // Event listener for re-rendering when editing the template
        this.template_area.addEventListener("input", async () => {
            if (is_dropdown_value(this.dropdown.value)) {
                let template = this.get_template(this.dropdown.value);
                if (template == null) {
                    console.warn(`couldn't get template ${this.dropdown.value}`);
                } else {
                    template.set_content(template_area.value);
                }

                this.regenerate_ui();
                render();
            }
        })

        // Event listener for the delete button
        this.delete_template_button.addEventListener("click", () => {
            let dropdown_value = this.dropdown.value;
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

                this.renegerate_dropdown();
                if (index < this.custom_templates.length) {
                    this.set_current_template(custom_i(index));
                } else if (this.custom_templates.length != 0 && index != 0) {
                    this.set_current_template(custom_i(index - 1));
                } else if (is_dropdown_value(this.dropdown.value)) {
                    this.set_current_template(this.dropdown.value);
                } else {
                    this.set_current_template(builtin_i(0));
                }

                this.regenerate_ui();
                render();
            }
        });

        // Event listener for the rename button
        this.rename_template_button.addEventListener("click", () => {
            let dropdown_value = this.dropdown.value;
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

                this.renegerate_dropdown();
                save_custom_templates(this.custom_templates);
            }
        });

        // Event listener to save custom templates when leaving the page + every 5 seconds.
        window.addEventListener("beforeunload", () => save_custom_templates(this.custom_templates));
        window.setInterval(() => save_custom_templates(this.custom_templates), 5000);


        // Set up the dropdown nodes.
        this.renegerate_dropdown();

        // Set the current template to the first builtin template.
        this.set_current_template("builtin-0");
    }

    /**
     * 
     * @param {HTMLSelectElement} template_dropdown the dropdown that presets will be located in.
     * @param {HTMLTextAreaElement} template_area the editable template window
     * @param {HTMLButtonElement} edit_template_button the "Edit Template" button
     * @param {HTMLButtonElement} delete_template_button the "Delete Template" button
     * @param {HTMLButtonElement} rename_template_button the "Rename Template" button
     * @param {HTMLDivElement} template_ui the area for the template UI.
     * @returns {Promise<TemplateControls>} 
     */
    static async mount(template_dropdown, template_area, edit_template_button, delete_template_button, rename_template_button, template_ui) {
        let builtin_templates = [DISCORD_BUILTIN, TWITTER_BUILTIN, PESTERLOG_BUILTIN, FOOTBALL_BUILTIN];
        let custom_templates = get_custom_templates();
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
     * Add a new blank custom preset
     */
    add_new_preset() {
        let i = this.custom_templates.length;

        let new_template = Template.custom("Custom Template " + i, BASIC_TEMPLATE);
        this.custom_templates.push(new_template);

        this.renegerate_dropdown();
        this.set_current_template(custom_i(i));
    }

    /**
     * @param {DropdownName} dropdown_name the name of the template used by the dropdown selector
     * @returns {Template} the Template that has the given name
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
     * Sets the given template as the current template
     * @param {DropdownName} dropdown_name the name of the template used by the dropdown selector
     */
    set_current_template(dropdown_name) {
        this.dropdown.value = dropdown_name;
        let template = this.get_template(dropdown_name);
        if (template == null) {
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

    renegerate_dropdown() {
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

        if (is_dropdown_value(last_dropdown_value)) {
            this.set_current_template(last_dropdown_value);
        }
    }

    /**
     * Returns the currently selected template
     * @returns {Template}
     */
    get_current_template() {
        let dropdown_name = this.dropdown.value;
        if (is_dropdown_value(dropdown_name)) {
            return this.get_template(dropdown_name)
        } else {
            throw new Error(`Currently selected dropdown value (${dropdown_name}) is not a DropdownName!`)
        }
    }

    regenerate_ui() {
        const html_nodes = this.get_current_template().get_ui_elements();
        this.template_ui.replaceChildren(...html_nodes);
    }
}

/**
 * @param {Array<Template>} templates the templates to save
 */
function save_custom_templates(templates) {
    console.info("Saving custom templates.");
    let saved_templates = templates.map((template) => {
        return {
            content: template.get_content(),
            displayed_name: template.displayed_name,
        }
    })
    localStorage.setItem("customTemplates", JSON.stringify(saved_templates));
}

/**
 * @returns {Array<Template>} the saved custom templates
 */
function get_custom_templates() {
    try {
        let stored_templates = localStorageOrDefault("customTemplates", []);
        if (!(Array.isArray(stored_templates))) {
            console.warn("stored template data wasn't an array!", stored_templates);
            return [];
        }

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
 * @private {string} #content
 */
class Template {
    #content;
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
        this.#ui_elements = parse_ui_description(content);
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
     * Returns the HTML elements of the UI. This attempts to find a comment within the template similar 
     * to the schema below:
     * {#-config
     * [{
     *      "name": "light_mode",
     *      "type": "boolean",
     *      "description": "Use Light Mode",
     *  }, {
     *      "name": "background_color",
     *      "type": "string",
     *      "description": "Custom Background Color",
     *  },
     * ]
     * config-#}
     * This format is, specifically, a JSON string containing array of objects that have a name, type,
     * and description keys, all of which have string values.
     * @returns {Array<HTMLElement>}
     */
    get_ui_elements() {
        return this.#ui_elements.map((element) => element.get_html_element());
    }

    /**
     * @returns {string}
     */
    get_content() {
        return this.#content;
    }

    /**
     * @param {string} new_content 
     */
    set_content(new_content) {
        this.#content = new_content;
        this.#ui_elements = parse_ui_description(new_content);
    }

    /**
     * @param {string} displayed_name the displayed name of the template
     * @param {string} url the url to get the template from
     * @returns {Promise<Template>}
     */
    static async builtin(displayed_name, url) {
        let content = await get_template_from_url(url) ?? "Couldn't fetch template!";
        return new Template(displayed_name, content, true);
    }

    /**
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
 * @param {string} content 
 * @returns {Array<UIElement>}
 */
function parse_ui_description(content) {
    // Regenerate the UI elements.
    const regexp = /{#-config([\S\s]*)config-#}/;
    const matches = content.match(regexp);
    if (matches == null) {
        return [];
    }
    const json_text = matches[1];
    try {
        const json_arr = JSON.parse(json_text);
        if (!(json_arr instanceof Array)) {
            throw new Error(`expected ${json_text} to be JSON containing an array. Got ${json_arr} instead.`);
        }
        return json_arr.map((ui_desc) => {
            if (is_ui_description(ui_desc)) {
                return new UIElement(ui_desc);
            } else {
                console.error(ui_desc);
                throw new Error(`expected ${ui_desc} to be a UIDescription`);
            }
        });
    } catch (err) {
        console.error("Couldn't parse UI description from content! Reason: ", err);
        console.log(json_text);
        return [];
    }
}

class UIElement {
    #html_element;
    /**
     * @param {UIDescription} ui_description
     */
    constructor(ui_description) {
        const label = `template-ui-${ui_description.name}`;

        let input_element = h("input", { type: ui_description.type, id: label });
        let label_element = h("label", { for: label }, [ui_description.label]);

        this.#html_element = h("div", { class: "template-ui-element" }, [label_element, input_element]);
    }

    /**
     * @returns {HTMLElement}
     */
    get_html_element() {
        return this.#html_element;
    }
}

export const DISCORD_BUILTIN = await Template.builtin("Discord", "https://raw.githubusercontent.com/a2aaron/Cohoard/canon/templates/discord.html");
export const TWITTER_BUILTIN = await Template.builtin("Twitter", "https://raw.githubusercontent.com/a2aaron/Cohoard/canon/templates/twitter.html");
export const FOOTBALL_BUILTIN = await Template.builtin("17776", "https://raw.githubusercontent.com/a2aaron/Cohoard/canon/templates/17776.html");
export const PESTERLOG_BUILTIN = await Template.builtin("Pesterlog", "https://raw.githubusercontent.com/a2aaron/Cohoard/canon/templates/homestuck.html");


export const BASIC_TEMPLATE = await get_template_from_url("https://raw.githubusercontent.com/a2aaron/Cohoard/canon/templates/basic.html") ?? "Couldn't fetch template!";

/**
 * Returns an `<option>` tag
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