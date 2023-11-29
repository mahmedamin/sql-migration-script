const {
    getSpecificTables,
    getIgnoreInsertionTables,
    getTableStartSequence,
    sourceConfig,
    localConfig
} = require('../utils/env.util');
const sql = require('mssql');

const SPECIFIC_TABLES = getSpecificTables();
const IGNORE_INSERTIONS = getIgnoreInsertionTables();
const TABLE_START_SEQUENCE = getTableStartSequence();

const sourceConnection = new sql.ConnectionPool(sourceConfig);
const localConnection = new sql.ConnectionPool(localConfig);

exports.migrate = async function () {
    try {
        // Connect to the source and local databases
        await sourceConnection.connect();
        await localConnection.connect();

        console.log('--Migration Started--')

        await localConnection.query('EXEC sp_msforeachtable "ALTER TABLE ? NOCHECK CONSTRAINT all"');
        // Get the list of table names from the source database
        let tableNames;
        if (SPECIFIC_TABLES.length) {
            tableNames = SPECIFIC_TABLES
        } else {
            tableNames = await sourceConnection.query(`
              SELECT TABLE_NAME
              FROM INFORMATION_SCHEMA.TABLES
              WHERE TABLE_TYPE = 'BASE TABLE' order by TABLE_NAME
            `);
            tableNames = tableNames.recordset.map(row => row.TABLE_NAME);
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
            await localConnection.query(`IF OBJECT_ID('[${tableName}]', 'U') IS NOT NULL DROP TABLE [${tableName}]`);

            const createTableScript = await generateCreateTableScript(tableName);

            // Execute the CREATE TABLE script on the local database
            await localConnection.query(createTableScript.query);

            const insertDataScriptData = await generateInsertDataScripts(tableName);
            const insertDataScripts = insertDataScriptData.queries;

            if (insertDataScripts?.length) {
                for (const insertDataScript of insertDataScripts) {
                    const query = [];
                    if (createTableScript.hasIdentity) {
                        query.push(`SET IDENTITY_INSERT [${tableName}] ON;`);
                    }

                    query.push(insertDataScript);

                    if (createTableScript.hasIdentity) {
                        query.push(`SET IDENTITY_INSERT [${tableName}] OFF;`)
                    }

                    // return console.log('-q', query.join(' ')); // to test insert query

                    await localConnection.query(`${query.join(' ')}`);
                }
            }

            console.log(`Table '${tableName}' migrated with ${insertDataScriptData.totalRows} rows affected!`);
            console.log('------------------------------------------------')
        }

        await localConnection.query('EXEC sp_msforeachtable "ALTER TABLE ? WITH CHECK CHECK CONSTRAINT all"');
        console.log('--Migration Completed--')

    } catch (error) {
        console.error('Error in migration:', error);
    } finally {
        sourceConnection.close();
        localConnection.close();
    }
}

async function generateCreateTableScript(tableName) {
    // Initialize a variable to track if the table has an identity column
    let hasIdentity = false;

    // Generate the CREATE TABLE script for the given table

    const result = await sourceConnection.query(`
    SELECT *
    INTO #TempTable
    FROM [${tableName}]
    WHERE 1 = 0;

    EXEC sp_columns @table_name = '${tableName}';
  `);

    const columns = result.recordset
        .map((row) => {
            if (row.TYPE_NAME === 'ntext') {
                row.TYPE_NAME = 'nvarchar';
                row.PRECISION = 'max'
            }
            const columnDefinition = `[${row.COLUMN_NAME}] ${row.TYPE_NAME}${['varchar', 'nvarchar'].includes(row.TYPE_NAME) ? `(${row.PRECISION})` : ''}`;

            // Check if the column is an identity column
            if (row.TYPE_NAME.includes('identity')) {
                hasIdentity = true;
            }

            if (row.IS_NULLABLE === 'NO') {
                return `${columnDefinition} NOT NULL`;
            }
            return columnDefinition;
        })
        .join(', ');

    const createTableScript = `CREATE TABLE [${tableName}] (${columns});`;

    return {query: createTableScript, hasIdentity};
}

async function generateInsertDataScripts(tableName) {
    if (IGNORE_INSERTIONS.includes(tableName)) {
        return {queries: [], totalRows: 0};
    }

    // Generate the INSERT INTO script for the given table
    const result = await sourceConnection.query(`
    SELECT *
    FROM [${tableName}]
  `);

    const totalRows = result.recordset.length;
    if (!totalRows) {
        return {queries: [], totalRows: 0};
    }

    const columns = Object.keys(result.recordset[0])
        .map((col) => `[${col}]`)
        .join(', ');

    const batchSize = 1000;
    const insertScripts = [];

    // result.recordset = [result.recordset[0]]; // To test 1 row
    for (let i = 0; i < totalRows; i += batchSize) {
        const batch = result.recordset.slice(i, i + batchSize);

        const values = batch.map((row) => {
            const rowValues = Object.values(row).map((value) => {
                if (value === null) return 'NULL';

                if (typeof value === 'boolean') return value ? 1 : 0;
                if (typeof value === 'object') return `'${JSON.parse(JSON.stringify(value))}'`;
                if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;

                return value;
            });
            return `(${rowValues.join(', ')})`;
        });

        const insertScript = `
      INSERT INTO [${tableName}] (${columns})
      VALUES
      ${values.join(', ')}
    `;

        insertScripts.push(insertScript);
    }

    return {queries: insertScripts, totalRows};
}
