
/** @type {{[key: string]: {[key: string]: string | Error | null}}} */
let ERROR_MESSAGES = {};
let ERROR_ELEMENT = getTypedElementById(HTMLPreElement, "error-msg");

/**
 * Show an error message to the user. The error message has an associated "type" and "template".
 * These are used to selective show or hide error messages depending on the currently selected
 * template.
 * @param {string | Error} msg 
 * @param {string} type
 * @param {string} template
 */
export function set_error_message(msg, type, template) {
    if (ERROR_MESSAGES[template] === undefined) {
        ERROR_MESSAGES[template] = {};
    }
    ERROR_MESSAGES[template][type] = msg;
}

/**
 * Stop showing the error message to the user.
 * @param {string} type
 * @param {string} template
 */
export function unset_error_message(type, template) {
    if (ERROR_MESSAGES[template] && ERROR_MESSAGES[template][type]) {
        ERROR_MESSAGES[template][type] = null;
    }
}

/**
 * Show the error messages associated with the given template.
 * @param {string} template 
 */
export function render_error_messages(template) {
    let message = "";

    if (ERROR_MESSAGES[template] != undefined) {
        for (let error of Object.values(ERROR_MESSAGES[template])) {
            if (error != null) {
                message += error.toString();
                message += "\n\n";
            }
        }
    }

    if (ERROR_MESSAGES["ALL"] != undefined) {
        for (let error of Object.values(ERROR_MESSAGES["ALL"])) {
            if (error != null) {
                message += error.toString();
                message += "\n\n";
            }
        }
    }
    console.log(ERROR_MESSAGES, template, ERROR_MESSAGES[template], message);
    ERROR_ELEMENT.innerText = message.trimEnd();
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
        return fallback;
    }
    try {
        return JSON.parse(obj);
    } catch (err) {
        console.warn(err);
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