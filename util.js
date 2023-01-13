import { ConfigTable } from "./config_table.js";

/** @type {{[key: string]: {[key: string]: string | Error | null}}} */
let ERROR_MESSAGES = {};
let ERROR_ELEMENT = getTypedElementById(HTMLPreElement, "error-msg");

/**
 * Show the error messages associated with the given template.
 * @param {...Error} errors
 */
export function render_error_messages(...errors) {
    let message = "";

    for (let error of errors) {
        console.log(error);
        message += recursively_to_string(error);
        message += "\n\n";
    }

    ERROR_ELEMENT.innerText = message.trimEnd();
}

/**
 * Transform an error to a string, recursing into the `causes` field if available.
 * @param {Error} err 
 * @return {string}
 */

export function recursively_to_string(err) {
    let string = err.message;
    if (err.cause) {
        string += recursively_to_string(err.cause);
    }
    return string;
}

/**
 * Yields pairs of (index, item) from an array.
 * @param {Array<T>} items An array of items
 * @returns {Generator<[number, T]>} a tuple of (index, item)
 * @template T
 */
export function* enumerate(items) {
    let i = 0;
    for (const item of items) {
        yield [i, item];
        i += 1;
    }
}

/**
 * Attempts to get an object from localStorage and parse it as JSON, falling back to a default value
 * if this fails.
 * @template T
 * @param {string} key the key in localStorage to look up
 * @param {T} fallback the fallback item to fall back to.
 * @returns {any | T} The parsed object from localStorage, or the fallback if that fails
 */
export function localStorageOrDefault(key, fallback) {
    let obj = localStorage.getItem(key);
    if (obj == null) {
        console.warn(`${key} not present in localStorage! using fallback instead...`);
        return fallback;
    }
    try {
        return JSON.parse(obj);
    } catch (err) {
        console.warn(`Could not parse ${key} JSON:`, err, obj);
        return fallback;
    }
}

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
export function h(tag, attrs, body = []) {
    const element = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        // Special-case the value and have it set the actual node value
        if (k == "value") {
            // @ts-ignore
            element["value"] = v;
        } else {
            element.setAttribute(k, v);
        }
    }

    if (Array.isArray(body)) {
        element.append(...body);
    } else {
        element.append(body);
    }
    return element;
}

/**
 * @template ElementType
 * @param {any} object 
 * @param {Constructor<ElementType>} type The HTML element name to check for
 * @returns {asserts object is ElementType}
 */
export function assert_html_node(object, type) {
    if (!(object instanceof type)) {
        throw new Error(`expected ${object} to be HTML node of type ${type.name}. Got ${object.constructor.name} instead.`);
    }
}

/**
 * @template T
 * @typedef {new (...args: any[]) => T} Constructor
 */

/**
 * @template ElementType
 * @param {Constructor<ElementType>} ty
 * @param {string} id
 * @returns {ElementType}
 */
export function getTypedElementById(ty, id) {
    let element = document.getElementById(id);
    if (element == null) { throw new Error(`Element with id ${id} not found!`); }
    if (!(element instanceof ty)) {
        throw new Error(`Element with id ${id} is type ${element.constructor.name}, wanted ${ty}`);
    }
    return element;
}

/**
 * Try to parse an error thrown from Tera into a more useful error.
 * @param {Error} err
 * @param {ConfigTable} config_table
 * @returns {[Error, string | null]}
 */
export function try_parse_tera_error(err, config_table) {
    let missing_var = parse_as_missing_variable(err.message);
    let bad_column = null;
    if (missing_var) {
        const field = parse_as_missing_field(missing_var);
        if (field) {
            // Try to highlight the missing field in the config table.
            if (config_table.has_column(field)) {
                err = new Error(`Field "${field}" is missing from a row in the Config Table\n`, { cause: err });
                bad_column = field;
            } else {
                err = new Error(`Couldn't find a field named "${field}" (Maybe you need to add it to the Config Table?)\n`, { cause: err });
            }
        } else {
            err = new Error(`Invalid variable "${missing_var}"\n`, { cause: err });
        }
    }

    return [err, bad_column];

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
