const {
    getSpecificTables,
    getIgnoreInsertionTables,
    getTableStartSequence,
    sourceConfig,
    localConfig
} = require('../utils/env.util');
const mysql = require('mysql2/promise');

const SPECIFIC_TABLES = getSpecificTables();
const IGNORE_INSERTIONS = getIgnoreInsertionTables();
const TABLE_START_SEQUENCE = getTableStartSequence();

const sourceConnection = mysql.createPool(sourceConfig);
const localConnection = mysql.createPool(localConfig);

exports.migrate = async function () {
    try {
        console.log('--Migration Started--')

        // Get the list of table names from the source database
        let tableNames;
        if (SPECIFIC_TABLES.length) {
            tableNames = SPECIFIC_TABLES
        } else {
            const [tables] = await sourceConnection.query(`
              SELECT table_name
              FROM information_schema.tables
              WHERE table_schema = 'your_database_name' and table_type = 'BASE TABLE' order by table_name
            `);
            tableNames = tables.map(row => row.table_name);
        }

        // Loop through each table and copy schema
        let sno = 0;
        const totalTables = tableNames.length;
        for (const tableName of tableNames) {
            sno++;

            if (sno < TABLE_START_SEQUENCE) {
                console.log(`${sno}/${totalTables}: skipping table '${tableName}'`);
                continue;
            }

            console.log(`${sno}/${totalTables}: migrating table`, tableName);

            // Drop local tables (if they exist)
            await localConnection.query(`DROP TABLE IF EXISTS \`${tableName}\``);

            const createTableScript = await generateCreateTableScript(tableName);

            // Execute the CREATE TABLE script on the local database
            await localConnection.query(createTableScript.query);

            const insertDataScriptData = await generateInsertDataScripts(tableName);
            const insertDataScripts = insertDataScriptData.queries;

            if (insertDataScripts?.length) {
                for (const insertDataScript of insertDataScripts) {
                    // Execute the insert script
                    await localConnection.query(insertDataScript);
                }
            }

            console.log(`Table '${tableName}' migrated with ${insertDataScriptData.totalRows} rows affected!`);
            console.log('------------------------------------------------')
        }

        console.log('--Migration Completed--')

    } catch (error) {
        console.error('Error in migration:', error);
    } finally {
        // Close connections (handled automatically in mysql2/promise)
    }
}

async function generateCreateTableScript(tableName) {
    // Generate the CREATE TABLE script for the given table
    const [columns] = await sourceConnection.query(`
      SHOW CREATE TABLE \`${tableName}\`
    `);

    const createTableScript = columns[0]['Create Table'];

    return {query: createTableScript, hasIdentity: false}; // hasIdentity is set manually if needed
}

async function generateInsertDataScripts(tableName) {
    if (IGNORE_INSERTIONS.includes(tableName)) {
        return {queries: [], totalRows: 0};
    }

    // Generate the INSERT INTO script for the given table
    const [rows] = await sourceConnection.query(`
      SELECT * FROM \`${tableName}\`
    `);

    const totalRows = rows.length;
    if (!totalRows) {
        return {queries: [], totalRows: 0};
    }

    const columns = Object.keys(rows[0])
        .map((col) => `\`${col}\``)
        .join(', ');

    const batchSize = 1000;
    const insertScripts = [];

    for (let i = 0; i < totalRows; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);

        const values = batch.map((row) => {
            const rowValues = Object.values(row).map((value) => {
                if (value === null) return 'NULL';
                if (typeof value === 'string') return `'${value.replace(/'/g, "\\'")}'`;
                return value;
            });
            return `(${rowValues.join(', ')})`;
        });

        const insertScript = `
          INSERT INTO \`${tableName}\` (${columns})
          VALUES
          ${values.join(', ')}
        `;

        insertScripts.push(insertScript);
    }

    return {queries: insertScripts, totalRows};
}