import { assert_html_node, h, localStorageOrDefault } from "./util.js";
import { render } from "./index.js";
/**
 * Manages the template preset UI
 */
export class TemplateControls {
    /**
     * @param {HTMLSelectElement} dropdown_element 
     * @param {HTMLTextAreaElement} template_area 
     * @param {Array<string>} custom_templates 
     * @param {Array<Template>} builtin_templates
     * @param {Array<Template>} custom_templates
     */
    constructor(dropdown_element, template_area, builtin_templates, custom_templates) {
        this.dropdown = dropdown_element;
        this.template_area = template_area;
        this.builtin_templates = builtin_templates;
        this.custom_templates = custom_templates;

        this.dropdown.addEventListener("input", async () => {
            if (this.dropdown.value.startsWith("none")) {
                return;
            } else if (this.dropdown.value == "new-preset") {
                this.add_new_preset()
            } else {
                let template = this.get_template(this.dropdown.value);
                this.set_current_template(template);
            }
            render();
        });

        this.template_area.addEventListener("input", async () => {
            let template = this.get_template(this.dropdown.value);
            template.content = template_area.value;
            render();
        })
    }

    /**
     * 
     * @param {HTMLSelectElement} dropdown_element the dropdown that presets will be located in.
     * @param {HTMLTextAreaElement} template_area the editable template window
     * @returns {TemplateControls}
     */
    static async mount(dropdown_element, template_area) {
        let builtin_templates = [
            await Template.builtin("Discord", "builtin-0", "https://raw.githubusercontent.com/a2aaron/Cohoard/canon/templates/discord.html"),
            await Template.builtin("Twitter", "builtin-1", "https://raw.githubusercontent.com/a2aaron/Cohoard/canon/templates/twitter.html")
        ];
        let custom_templates = localStorageOrDefault("customTemplates", []);
        let template_controls = new TemplateControls(dropdown_element, template_area, builtin_templates, custom_templates);

        template_controls.set_current_template(builtin_templates[0]);

        return template_controls;
    }

    /**
     * Add a new blank custom preset
     */
    add_new_preset() {
        let i = this.custom_templates.length;

        let new_template = Template.custom("Custom Template " + i, "custom-" + i);
        this.custom_templates.push(new_template);

        this.dropdown.insertBefore(new_template.get_html_node(), this.dropdown.lastElementChild)

        this.set_current_template(new_template);
    }

    /**
     * @param {string} the internal name of the tepmlate
     * @returns {Template} the Template that has the given name
     */
    get_template(internal_name) {
        if (internal_name.startsWith("builtin")) {
            let index = Number(internal_name.replace("builtin-", ""));
            return this.builtin_templates[index];
        } else if (internal_name.startsWith("custom")) {
            let index = Number(internal_name.replace("custom-", ""));
            return this.custom_templates[index];
        }
    }

    /**
     * Sets the given template as the current template.
     * @param {Template} template the name of the custom template to set to current
     */
    set_current_template(template) {
        this.dropdown.value = template.internal_name;

        this.template_area.readOnly = template.is_builtin;
        this.template_area.value = template.content;
    }
}

class Template {

    /**
     * @param {string} displayed_name the displayed name of the template
     * @param {string} internal_name the internal name of the template
     * @param {bool} is_builtin true if the template is builtin
     * @param {string | null} content the contents of the template (if not builtin)
     */
    constructor(displayed_name, internal_name, content, is_builtin) {
        this.displayed_name = displayed_name;
        this.internal_name = internal_name;
        this.is_builtin = is_builtin;
        this.content = content;
    }

    /**
     * Return a dropdown selection with the information of the template.
     * @returns {HTMLOptionElement}
     */
    get_html_node() {
        return option(this.internal_name, this.displayed_name, false);
    }

    /**
     * @param {string} displayed_name the displayed name of the template
     * @param {string} internal_name the internal name of the template
     * @param {string} url the url to get the template from
     * @returns {Template}
     */
    static async builtin(displayed_name, internal_name, url) {
        let content = await get_template_from_url(url);
        return new Template(displayed_name, internal_name, content, true);
    }

    /**
     * @param {string} displayed_name the displayed name of the template
     * @param {string} internal_name the internal name of the template
     * @param {string} url the url to get the template from
     * @returns {Template} 
     */
    static custom(displayed_name, internal_name) {
        return new Template(displayed_name, internal_name, "");
    }
}

/**
 * Returns an `<option>` tag
 * @param {string} value the value of the value attribute
 * @param {string} body the body of the option tag
 * @returns {HTMLOptionElement}
 */
function option(value, body) {
    return h("option", { value }, body);
}

/**
 * Returns a Tera template from the given URL.
 * @param {string} url the URL to fetch from
 * @returns {Promise<string | void>} the contents of the template 
 */
async function get_template_from_url(url) {
    let text = await fetch(url).then(response => {
        return response.text()
    }).catch(err => {
        console.warn(`Couldn't fetch from ${url}`);
        console.log(err);
    });
    return text;
}