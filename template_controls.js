import { h, localStorageOrDefault, enumerate } from "./util.js";
import { render } from "./index.js";
/**
 * Manages the template preset UI
 */
export class TemplateControls {
    /**
     * @param {HTMLSelectElement} dropdown_element 
     * @param {HTMLTextAreaElement} template_area 
     * @param {HTMLButtonElement} edit_template_button
     * @param {HTMLButtonElement} delete_template_button
     * @param {Array<Template>} builtin_templates
     * @param {Array<Template>} custom_templates
     */
    constructor(dropdown_element, template_area, edit_template_button, delete_template_button, builtin_templates, custom_templates) {
        this.dropdown = dropdown_element;
        this.template_area = template_area;
        this.edit_template_button = edit_template_button;
        this.delete_template_button = delete_template_button;
        this.builtin_templates = builtin_templates;
        this.custom_templates = custom_templates;

        // Event listener for re-rendering when changing the dropdown
        this.dropdown.addEventListener("input", async () => {
            if (this.dropdown.value == "new-preset") {
                this.add_new_preset()
            } else if (is_dropdown_value(this.dropdown.value)) {
                this.set_current_template(this.dropdown.value);
            }
            render();
        });

        // Event listener for re-rendering when editing the template
        this.template_area.addEventListener("input", async () => {
            if (is_dropdown_value(this.dropdown.value)) {
                let template = this.get_template(this.dropdown.value);
                template.content = template_area.value;
                render();
            }
        })

        // Event listener for the delete button
        this.delete_template_button.addEventListener("click", () => {
            let dropdown_value = this.dropdown.value;
            if (dropdown_value.startsWith("custom-")) {
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
                render();
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
     * @returns {Promise<TemplateControls>}
     */
    static async mount(template_dropdown, template_area, edit_template_button, delete_template_button) {
        let builtin_templates = [
            await Template.builtin("Discord", "https://raw.githubusercontent.com/a2aaron/Cohoard/canon/templates/discord.html"),
            await Template.builtin("Twitter", "https://raw.githubusercontent.com/a2aaron/Cohoard/canon/templates/twitter.html")
        ];
        let custom_templates = get_custom_templates();
        let template_controls = new TemplateControls(template_dropdown, template_area, edit_template_button, delete_template_button, builtin_templates, custom_templates);

        return template_controls;
    }

    /**
     * Add a new blank custom preset
     */
    add_new_preset() {
        let i = this.custom_templates.length;

        let new_template = Template.custom("Custom Template " + i, this.template_area.value);
        this.custom_templates.push(new_template);

        this.renegerate_dropdown();
        this.set_current_template(custom_i(i));
    }

    /**
     * @typedef {`builtin-${number}` | `custom-${number}`} DropdownName
     */

    /**
     * @param {DropdownName} dropdown_name the name of the template used by the dropdown selector
     * @returns {Template} the Template that has the given name
     */
    get_template(dropdown_name) {
        if (dropdown_name.startsWith("builtin")) {
            let index = Number(dropdown_name.replace("builtin-", ""));
            return this.builtin_templates[index];
        } else if (dropdown_name.startsWith("custom")) {
            let index = Number(dropdown_name.replace("custom-", ""));
            return this.custom_templates[index];
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

        this.template_area.readOnly = template.is_builtin;
        if (template.content == null) {
            console.warn(`template for ${dropdown_name} has null content!`, template);
            this.template_area.value = "Couldn't load template!";
        } else {
            this.template_area.value = template.content;
        }

        if (template.is_builtin) {
            this.edit_template_button.innerText = "View Template";
            this.delete_template_button.classList.add("hidden");
        } else {
            this.edit_template_button.innerText = "Edit Template";
            this.delete_template_button.classList.remove("hidden");
        }
    }

    renegerate_dropdown() {
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
    }
}

/**
 * @param {Array<Template>} templates the templates to save
 */
function save_custom_templates(templates) {
    console.info("Saving custom templates.");
    localStorage.setItem("customTemplates", JSON.stringify(templates));
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

class Template {
    /**
     * @param {string} displayed_name the displayed name of the template
     * @param {boolean} is_builtin true if the template is builtin
     * @param {string | null} content the contents of the template (if not builtin)
     */
    constructor(displayed_name, content, is_builtin) {
        this.displayed_name = displayed_name;
        this.is_builtin = is_builtin;
        this.content = content;
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
     * @param {string} displayed_name the displayed name of the template
     * @param {string} url the url to get the template from
     * @returns {Promise<Template>}
     */
    static async builtin(displayed_name, url) {
        let content = await get_template_from_url(url);
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