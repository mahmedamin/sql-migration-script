const mysql = require('mysql2/promise');
require('dotenv').config();

const { env } = process;

const SPECIFIC_TABLES = []; // If this array contains any table, it will only do migration for provided tables

// List of tables where insertion will be ignored
const IGNORE_INSERTIONS = ['__EFMigrationsHistory', '__MigrationHistory', 'api_token'];

const sourceConfig = {
    host: env.MYSQL_SERVER_DB_HOST,
    user: env.MYSQL_SERVER_DB_USER,
    password: env.MYSQL_SERVER_DB_PASSWORD,
    database: env.MYSQL_SERVER_DB_NAME,
};

const localConfig = {
    host: env.MYSQL_LOCAL_DB_HOST,
    user: env.MYSQL_LOCAL_DB_USER,
    password: env.MYSQL_LOCAL_DB_PASSWORD,
    database: env.MYSQL_LOCAL_DB_NAME,
};

async function copyTableSchemas() {
    try {
        // Connect to the source (server) and local MySQL databases
        const sourceConnection = await mysql.createConnection(sourceConfig);
        const localConnection = await mysql.createConnection(localConfig);

        console.log('-- Migration Started --');

        // Get the list of table names from the source (server) MySQL database
        let tableNames;
        if (SPECIFIC_TABLES.length) {
            tableNames = SPECIFIC_TABLES;
        } else {
            const [rows] = await sourceConnection.execute('SHOW TABLES');
            tableNames = rows.map((row) => row[`Tables_in_${sourceConfig.database}`]);
        }

        // Loop through each table and copy schema and data
        let sno = 0;
        const totalTables = tableNames.length;
        for (const tableName of tableNames) {
            sno++;

            // Drop local tables (if they exist)
            await localConnection.execute(`DROP TABLE IF EXISTS \`${tableName}\``);

            const createTableScript = await generateCreateTableScript(sourceConnection, tableName);

            // Execute the CREATE TABLE script on the local MySQL database
            await localConnection.execute(createTableScript.query);

            const insertDataScriptData = await generateInsertDataScripts(sourceConnection, tableName);
            const insertDataScripts = insertDataScriptData.queries;

            if (insertDataScripts?.length) {
                for (const insertDataScript of insertDataScripts) {
                    await localConnection.execute(insertDataScript);
                }
            }

            console.log(`${sno}/${totalTables}: Table '${tableName}' migrated with ${insertDataScriptData.totalRows} rows affected!`);
        }

        console.log('-- Migration Completed --');
        sourceConnection.end();
        localConnection.end();
    } catch (error) {
        console.error('Error:', error);
    }
}

async function generateCreateTableScript(connection, tableName) {
    // Initialize a variable to track if the table has an identity column
    let hasIdentity = false;

    // Generate the CREATE TABLE script for the given table
    const [columns] = await connection.execute(`DESCRIBE \`${tableName}\``);

    const createTableScript = `CREATE TABLE \`${tableName}\` (${columns.map((col) => {
        if (col.Type.includes('auto_increment')) {
            hasIdentity = true;
        }
        return `\`${col.Field}\` ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : ''}`;
    }).join(', ')});`;

    return { query: createTableScript, hasIdentity };
}

async function generateInsertDataScripts(connection, tableName) {
    if (IGNORE_INSERTIONS.includes(tableName)) {
        return { queries: [], totalRows: 0 };
    }

    // Generate the INSERT INTO script for the given table
    const [rows] = await connection.execute(`SELECT * FROM \`${tableName}\``);
    const totalRows = rows.length;

    if (!totalRows) {
        return { queries: [], totalRows: 0 };
    }

    const columns = Object.keys(rows[0]).map((col) => `\`${col}\``).join(', ');
    const batchSize = 1000;
    const insertScripts = [];

    for (let i = 0; i < totalRows; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);

        const values = batch.map((row) => {
            const rowValues = Object.values(row).map((value) => {
                if (value === null) return 'NULL';
                if (typeof value === 'boolean') return value ? 1 : 0;
                if (typeof value === 'object') return `'${JSON.stringify(value)}'`;
                if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
                return value;
            });
            return `(${rowValues.join(', ')})`;
        });

        const insertScript = `INSERT INTO \`${tableName}\` (${columns}) VALUES ${values.join(', ')}`;
        insertScripts.push(insertScript);
    }

    return { queries: insertScripts, totalRows };
}

copyTableSchemas();
