require('dotenv').config();

const {env} = process;

if (!env.CONNECTION_MODE) {
    console.log('Please set CONNECTION_MODE in .env file');
    process.exit(1);
}

switch (env.CONNECTION_MODE) {
    case 'mysql':
        require('./migration-scripts/migration-mysql').migrate();
        break;
    case 'mssql':
        require('./migration-scripts/migration-mssql').migrate();
        break;
    default:
        console.log('Invalid CONNECTION_MODE');
        process.exit(1);
}