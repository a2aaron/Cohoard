/**
 * Attempts to get an object from localStorage and parse it as JSON, falling back to a default value
 * if this fails.
 * @param {string} key the key in localStorage to look up
 * @param {T} fallback the fallback item to fall back to.
 * @returns {T} The parsed object from localStorage, or the fallback if that fails
 * @template T
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
            element.value = v;
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
 * @param {any} object 
 * @param {string} name The HTML element name to check for
 * @returns {bool} Returns true if `object` is an HTML element of type `name`.
 */
export function is_html_node(object, name) {
    console.assert(name);
    if (object.tagName == undefined) {
        return false;
    }
    return object.tagName.toLowerCase() == name.toLowerCase();
}

/**
 * @param {any} object 
 * @param {string} name The HTML element name to check for
 */
export function assert_html_node(object, name) {
    console.assert(name);
    if (!is_html_node(object, name)) {
        let tagName = object.tagName.toLowerCase();
        console.error(`object ${object} expected to be HTML node of type ${name}. Got ${tagName} instead.`);
        console.log(object.outerHTML);
    }
}

