require('dotenv').config();
const {env} = process;

exports.getSpecificTables = () => {
    const tables = env.SPECIFIC_TABLES;
    if (!tables) {
        return [];
    }

    return tables.split(',').map((table) => table.trim());
}

exports.getIgnoreInsertionTables = () => {
    const tables = env.IGNORE_INSERTIONS;
    if (!tables) {
        return [];
    }

    return tables.split(',').map((table) => table.trim());
}

exports.getTableStartSequence = () => {
    return parseInt(env.TABLE_START_SEQUENCE || 1);
}

exports.sourceConfig = {
    user: env.SOURCE_DB_USER,
    password: env.SOURCE_DB_PASSWORD,
    server: env.SOURCE_DB_HOST,
    database: env.SOURCE_DB_NAME,
};

exports.localConfig = {
    user: env.LOCAL_DB_USER,
    password: env.LOCAL_DB_PASSWORD,
    server: env.LOCAL_DB_HOST,
    database: env.LOCAL_DB_NAME,
    options: {
        trustServerCertificate: true,
    },
};