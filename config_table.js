import * as cohoard from "https://static.witchoflight.com/~a2aaron/cohoard/v0.4.0/cohoard.js";

import { render } from "./index.js";
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

        this.element.addEventListener("input", () => {
            this.#check_bottom_row();
            this.#check_right_column();

            render();
            this.save_table()
        });

        window.addEventListener("beforeunload", () => this.save_table());
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

    /**
     * Appends a row to the table, leaving a blank row at the end. The row's values will consist of
     * the init_value's keys
     * @param {object} init_values the initial values of the row. This is a dictionary. The keys of 
     * the dictionary correspond to column keys, and the values of the dictionary correspond to the 
     * initial value the cell corresponding to the column key will have. If the Config table contains
     * a column key that the `init_values` dictionary does not have, the corresponding cell will be
     * blank. If `init_values` contains a column key that the Config table does not have, a new column
     * will be appended to the table containing the key, and the other rows in the table will have empty
     * initial values.
     */
    append_row(init_values) {
        let columns = get_columns(this.table);
        let blanks = Array.from({ length: columns.length }).map(el => "");
        let row = make_row(blanks, columns);
        let last_row = this.table.lastChild;
        this.table.insertBefore(row, last_row);
        for (const [col_key, init_value] of Object.entries(init_values)) {
            let col_index = columns.indexOf(col_key);
            let input;
            if (col_index == -1) {
                this.append_blank_column(col_key);
                input = into_input(row.cells[row.cells.length - 2]);
            } else {
                input = into_input(row.cells[col_index]);
            }
            input.value = init_value;
        }
        this.save_table()
    }

    /**
     * Appends a blank column to the table, ensuring there is a blank column at the end.
     * @param {string} column_key The value of the column key
     */
    append_blank_column(column_key) {
        let last_col_i = this.table.rows[0].cells.length - 1;
        for (let row of this.table.rows) {
            let cell;
            if (row.rowIndex == 0) {
                cell = column_cell(this.table, last_col_i + 1, column_key);
            } else {
                cell = body_cell("", column_key);
            }

            row.insertBefore(cell, row.lastChild);
        }
        this.save_table()
    }

    /**
     * Check if the bottom-most row is non-empty. If it is, add a row.
     * @returns {boolean} true if a row was added
     */
    #check_bottom_row() {
        console.assert(this.table.rows.length >= 2);
        let last_row = this.table.rows.length - 1;

        if (!is_row_empty(this.table, last_row)) {
            let placeholders = get_columns(this.table);
            // An array of empty strings
            let init_values = Array.from({ length: placeholders.length }).map(el => "");
            let row = make_row(init_values, placeholders);
            this.table.appendChild(row)
            return true;
        } else {
            return false;
        }


    }

    /**
     * Check if the right-most column is non-empty. If it is, add a column.
     * @returns {boolean} true if a row was added
     */
    #check_right_column() {
        let last_col_i = this.table.rows[0].cells.length - 1;
        if (!is_column_empty(this.table, last_col_i)) {
            for (let row of this.table.rows) {
                if (row.rowIndex == 0) {
                    row.appendChild(column_cell(this.table, last_col_i + 1, ""));
                } else {
                    row.appendChild(body_cell("", ""));
                }
            }
            return true;
        } else {
            return false;
        }
    }

    /**
     * Removes fully empty rows or columns. Will always leave at least two rows and two columns however.
     * (The "key" column cannot be removed, nor can the row containing the keys. Additionally, at
     * least one blank row and column will also always be kept.)
     * @returns {boolean} true if a column or row was removed
     */
    remove_empty_rows_and_columns() {
        let table_width = this.table.rows[0].cells.length;
        let table_height = this.table.rows.length;

        let did_delete = false;
        for (let row_i = table_height - 1; row_i >= 0; row_i--) {
            // Skip the first and last rows.
            if (row_i == 0 || row_i == table_height - 1) {
                continue;
            }

            if (is_row_empty(this.table, row_i)) {
                this.table.deleteRow(row_i);
                did_delete = true;
            }
        }

        for (let col_i = table_width - 1; col_i >= 0; col_i--) {
            if (col_i == 0 || col_i == table_width - 1) {
                continue;
            }

            if (is_column_empty(this.table, col_i)) {
                for (let row of this.table.rows) {
                    row.deleteCell(col_i);
                }
                did_delete = true;
            }
        }
        this.save_table();
        return did_delete;
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
            header_row.appendChild(column_cell(table, i, col));
        }

    }

    table.appendChild(header_row);

    for (const row of body) {
        table.appendChild(make_row(row, cols));
    }

    return table;
}

/**
 * Creates an `HTMLTableRowElement` containing `init_values.length` `HTMLTableCellElements`, each of which contains a
 * `HTMLInputElement`. 
 * @param {Array<string>} init_values the initial values for each `HTMLInputElement`.
 * @param {Array<string>} placeholders the placeholder strings for each `HTMLInputElement`
 * @returns {HTMLTableRowElement}
 */
function make_row(init_values, placeholders) {
    console.assert(init_values.length == placeholders.length);

    let row_node = document.createElement("tr");
    for (let i = 0; i < init_values.length; i += 1) {
        let init_value = "";
        if (init_values[i] != undefined) {
            init_value = init_values[i];
        }
        row_node.appendChild(body_cell(init_value, placeholders[i]));
    }
    return row_node;
}

/**
 * Update the placeholder text of the cells in a specified column.
 * @param {HTMLTableElement} table The table to update the placeholders in
 * @param {HTMLTableCellElement} header_cell The header cell of the column to update.
 * If this cell is in the first column, then nothing happens.
 * @param {string} new_placeholder The new placeholder text to use
 */
function update_placeholders(table, header_cell, new_placeholder) {
    // The first col is always the "key" column, so we can ignore it.
    if (header_cell.cellIndex == 0) {
        return;
    }

    for (let row of table.rows) {
        // Skip the header row
        if (row.rowIndex == 0) {
            continue;
        }
        let cell = row.cells[header_cell.cellIndex];
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
 * Check if a particular row of a table is empty.
 * @param {HTMLTableElement} table The table to check
 * @param {number} row_i The index of the row to check
 * @returns {boolean} true if the row's `HTMLInputElement`s are all the empty string.
 * Note that the zeroth row is always non-empty (since it contains the unmodifiable "key" field)
 */
function is_row_empty(table, row_i) {
    console.assert(row_i >= 0);
    if (row_i == 0) {
        return false;
    }

    console.assert(row_i < table.rows.length);
    let row = table.rows[row_i];
    for (let cell of row.cells) {
        let input = into_input(cell);
        if (input.value != "") {
            return false;
        }
    }
    return true;
}

/**
 * Check if a particular column of a table is empty.
 * @param {HTMLTableElement} table The table to check
 * @param {number} column_i The index of the column to check
 * @returns {boolean} true if the column's `HTMLInputElement`s are all the empty string.
 * Note that the zeroth column is always non-empty (since it contains the unmodifiable "key" field)
 */
function is_column_empty(table, column_i) {
    console.assert(column_i >= 0);
    if (column_i == 0) {
        return false;
    }

    for (let row_i = 0; row_i < table.rows.length; row_i++) {
        console.assert(column_i < table.rows[row_i].cells.length);

        let input = into_input(table.rows[row_i].cells[column_i]);
        if (input.value != "") {
            return false;
        }
    }
    return true;
}

/**
 * Return a column cell for the table. The column cell has an event handler which updates the placeholder
 * text of the body cells when the cell is edited.
 * @param {HTMLTableElement} table - The table which placeholder values are updated when editing.
 * @param {number} col_i - The column index of the new column cell. Used for the event listener.
 * @param {string} value - The initial value of the column cell's text input.
 * @returns {HTMLTableCellElement} - The table cell containing the text input.
 */
function column_cell(table, col_i, value) {
    let input = h("input", { type: "text", placeholder: "key name", value: value });
    let header_cell = h("th", {}, input);
    assert_html_node(header_cell, HTMLTableCellElement);

    // Update the placeholder text whenever the header cell is edited.
    header_cell.addEventListener("input", () => {
        assert_html_node(header_cell, HTMLTableCellElement);
        assert_html_node(input, HTMLInputElement);
        update_placeholders(table, header_cell, input.value)
    });
    return header_cell;
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

/**
 * Returns the `HTMLInputElement` element contained within the `HTMLTableCellElement`. This function
 * will throw if the `cell` does not contain an `HTMLInputElement`.
 * @param {HTMLTableCellElement} cell - The cell to get the `HTMLInputElement`
 * @returns {HTMLInputElement} - The `HTMLInputElement` element inside the `HTMLTableCellElement`
 */
function into_input(cell) {
    assert_html_node(cell.firstChild, HTMLInputElement);
    return cell.firstChild;
}