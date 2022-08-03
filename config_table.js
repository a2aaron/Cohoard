import * as cohoard from "https://static.witchoflight.com/~a2aaron/cohoard/0.3.1/cohoard.js";

import { h, localStorageOrDefault, assert_html_node } from "./util.js";

/**
 * Manages the `<table>` which contains the UI for editing the Config data.
 */
export class ConfigTable {
    /**
     * Construct a ConfigTable, appending a `<table>` to the given element.
     * @param {HTMLElement} element The element to mount the table to.
     * @param {Array<string>} columns The column headers.
     * @param {Array<Array<string>>} body The initial value of the body cells.
     */
    constructor(element, columns, body) {
        this.element = element;
        this.table = make_table_node(columns, body);
        element.appendChild(this.table);
    }

    /**
     * Mount a config table on the given element. Attempts to use localStorage to fill in the initial
     * table inputs.
     * @param {HTMLElement} element The element to mount the table to
     * @param {Array<string>} init_cols The initial column headers to generate.
     * May generate more columns if localStorage has more columns saved
     * @param {number} num_rows The minimum number of rows to generate
     * May generate more rows if localStore has more rows saved.
     * @returns {ConfigTable}
    */
    static mount(element, init_cols, num_rows) {
        // JS has some slightly annoying behavior with arrays. See below link.
        // https://stackoverflow.com/questions/41121982/strange-behavior-of-an-array-filled-by-array-prototype-fill
        let fallback_body = Array.from(Array(num_rows), () => Array(init_cols.length).fill(""));
        let eggbug_row = ["EGGBUG", "egg bug!", "#83254f", "https://i.imgur.com/BBaogem.png", "eggbug"]
        fallback_body[0] = eggbug_row;
        let body = localStorageOrDefault("configTableBody", fallback_body);
        let cols = localStorageOrDefault("configTableCols", init_cols);

        let table = new ConfigTable(element, cols, body);
        return table;
    }

    /** Save the table to localStorage */
    save_table() {
        let [cols, body] = array_from_table(this.table);
        localStorage.setItem("configTableBody", JSON.stringify(body));
        localStorage.setItem("configTableCols", JSON.stringify(cols));
    }

    /**
     * Get a Cohoard-usable Config object from the data represented by the table.
     * @returns {cohoard.Config}
     */
    get cohoard_config() {
        return cohoard_config_from_table(this.table);
    }

    /**
     * Set a column of the table as red
     * @param {string} key the column whose key is `key` to set red
     * @returns {boolean} true if the column was found in the table and marked as red.
     */
    mark_err(key) {
        const columns = get_columns(this.table);
        const index = columns.findIndex((value) => { return value == key; });
        if (index == -1) {
            return false;
        }

        for (const row of this.table.rows) {
            if (row.rowIndex == 0) {
                continue;
            }
            const cell = row.cells[index];
            // Highlight all cells that have a key but not the given field.
            const cell_input = cell.firstChild;
            const key_input = row.cells[0].firstChild;
            assert_html_node(cell_input, HTMLInputElement);
            assert_html_node(key_input, HTMLInputElement);
            if (cell_input.value == "" && key_input.value != "") {
                cell.style.color = "red";
            }
        }

        return true;
    }

    /**
     * Unset all columns of the table
     */
    unmark_errs() {
        for (const row of this.table.rows) {
            for (const cell of row.cells) {
                cell.style.color = "black";
            }
        }
    }
}

/**
 * Generates a `<table>` of the config data
 * @param {Array<string>} cols The columns headers that will be generated
 * @param {Array<Array<string>>} body The initial table body vaues that will be generated
 * If a row of the body has less cells than cols, then empty cells will be generated.
 * If a row of the body has more cells than cols, then blank columns will be generated.
 * @returns {HTMLTableElement} The generated `table`.
 */
function make_table_node(cols, body) {
    let max_body_length = Math.max(...body.map((row) => row.length));
    if (max_body_length > cols.length) {
        cols = cols.concat(Array(max_body_length - cols.length).fill(""));
    }

    let table = document.createElement("table");

    let header_row = document.createElement("tr");
    header_row.setAttribute("class", "config-row-header");
    for (let i = 0; i < cols.length; i++) {
        const col = cols[i];
        if (col == "key") {
            let cell = h("th", {}, "key");
            header_row.appendChild(cell);
        } else {
            let textarea = /** @type { HTMLInputElement } */ (h("input", { type: "text", placeholder: "key name", value: col }));
            // Update the placeholder text whenever the header cell is edited.
            let cell = h("th", {}, textarea);
            cell.addEventListener("input", () => update_placeholders(table, i, textarea.value));
            header_row.appendChild(cell);
        }

    }

    table.appendChild(header_row);

    for (const row of body) {
        let row_node = document.createElement("tr");
        for (let i = 0; i < cols.length; i += 1) {
            let init_value = "";
            if (row[i] != undefined) {
                init_value = row[i];
            }
            row_node.appendChild(body_cell(init_value, cols[i]));
        }
        table.appendChild(row_node);
    }

    return table;
}

/**
 * Update the placeholder text of the cells in a specified column.
 * @param {HTMLTableElement} table The table to update the placeholders in
 * @param {number} col_i The index of column to update. If this is 0, then nothing happens.
 * @param {string} new_placeholder The new placeholder text to use
 */
function update_placeholders(table, col_i, new_placeholder) {
    // The first col is always the "key" column, so we can ignore it.
    if (col_i == 0) {
        return;
    }

    for (let row of table.rows) {
        // Skip the header row
        if (row.rowIndex == 0) {
            continue;
        }
        let cell = row.cells[col_i];
        assert_html_node(cell.firstChild, HTMLInputElement);
        cell.firstChild.placeholder = new_placeholder;
    }
}

/**
 * Takes the user-displayed table and turns it into a 2D array.
 * @param {HTMLTableElement} table The table to generate the array from. 
 * This needs to be a table generated by `make_table_node`.
 * @returns {[Array<string>, Array<Array<string>>]} A tuple of the header columns and the body rows
 */
function array_from_table(table) {
    let cols = get_columns(table);

    let body = [];
    for (let row of table.rows) {
        // Skip the header rows
        if (row.rowIndex == 0) {
            continue;
        }
        let body_row = []
        for (let cell of row.cells) {
            assert_html_node(cell.firstChild, HTMLInputElement);
            let cell_value = cell.firstChild.value;
            body_row.push(cell_value);
        }
        body.push(body_row);
    }
    return [cols, body];
}

/**
 * Takes the user-displayed table and turns it into an intenal Config object.
 * @param {HTMLTableElement} table The table to generate the config from. 
 * This needs to be a table generated by `make_table_node`.
 * @returns {cohoard.Config} the config specified by the table.
 */
function cohoard_config_from_table(table) {
    let cols = get_columns(table);

    let people = [];
    row_loop: for (let row of table.rows) {
        // Skip the header rows
        if (row.rowIndex == 0) {
            continue;
        }
        /** @type {{[key: string]: string}} */
        let person = {}
        cell_loop: for (let cell of row.cells) {
            assert_html_node(cell.firstChild, HTMLInputElement);
            let cell_key = cols[cell.cellIndex];
            let cell_value = cell.firstChild.value;
            if (cell_value == "") {
                if (cell_key == "key") {
                    // If the key doesn't exist, don't create a person at all
                    // (Cohoard requires the key to be set)
                    continue row_loop;
                } else {
                    // Don't set the property if the input is blank.
                    // This allows Cohoard to use a default value instead of thinking
                    // the property is set to the empty string.
                    continue cell_loop;
                }
            } else {
                person[cell_key] = cell_value;
            }
        }
        people.push(person);
    }
    let config_json = JSON.stringify({ people });
    return cohoard.load_config(config_json);
}

/**
 * Gets the values in the header row.
 * @param {HTMLTableElement} table 
 * @returns {Array<string>} the values of the header row.
 */
function get_columns(table) {
    let cols = [];
    let first_row = table.rows[0];
    for (let cell of first_row.cells) {
        if (cell.firstChild instanceof HTMLInputElement) {
            cols.push(cell.firstChild.value);
        } else {
            cols.push("key");
        }
    }
    return cols;
}


/**
 * Return a body cell for the table.
 * @param {string} value - The initial text of the text input
 * @param {string} placeholder - The placeholder text for the text input
 * @returns {HTMLTableCellElement} - The table cell containing the text input
 */
function body_cell(value, placeholder) {
    let cell = h("td", {},
        h("input", { type: "text", placeholder, value, style: "color: inherit;" })
    );
    return /** @type {HTMLTableCellElement} */ (cell);
}