const {migrate} = require("./migration-scripts/migration-mssql");
require('dotenv').config();

migrate()