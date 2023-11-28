# Database Data Migration Tool

A utility tool for migrating data from server database to a local development environment.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Getting Started](#getting-started)
    - [Prerequisites](#prerequisites)
    - [Installation](#installation)
- [Usage](#usage)
    - [Configuration](#configuration)
    - [Migrating Data](#migrating-data)
- [Contributing](#contributing)
- [License](#license)

## Overview

The Database Data Migration Tool is designed to simplify the process of copying data from server database to your local development environment. This tool is particularly useful for developers who need access to up-to-date data for testing and development purposes.

## Features

- Copy data from server database to your local database.
- Supports SQL Server and MySQL as source databases.
- Easily configurable via environment variables.
- Provides progress updates during data migration.

## Getting Started

### Prerequisites

Before using this tool, ensure you have the following prerequisites installed:

- Node.js: [https://nodejs.org/](https://nodejs.org/)
- npm (Node Package Manager): [https://www.npmjs.com/](https://www.npmjs.com/)
- MySQL server: [https://dev.mysql.com/downloads/mysql/](https://dev.mysql.com/downloads/mysql/) (if using MySQL as the source database)
- SQL Server (if using SQL Server as the source database)

### Installation

1. Clone this repository to your local machine:
```
git clone https://github.com/yourusername/database-data-migration-tool.git
```

2. Navigate to the project directory:
```
cd database-data-migration-tool
```

3. Install the required Node.js packages:
```
npm install
```

## Usage

### Configuration

Configuration is done via environment variables. To get started, follow these steps:

1. Copy the `.env.example` file and create a new file named `.env`:
```
cp .env.example .env
```

2. Open the `.env` file and replace the connection strings with your actual database connection details.

### Migrating Data

To copy data from the server's database to your local development environment, run the following command:
```
npm run migrate-data
```

The tool will automatically copy the data from the live production database to your local development database, ensuring that your local environment has up-to-date data for testing and development.

## Contributing

Contributions are welcome! If you'd like to contribute to this project, please follow these guidelines:

1. Fork the repository.
2. Create a new branch for your feature or bug fix: `git checkout -b feature/my-feature` or `git checkout -b bugfix/my-bug-fix`.
3. Commit your changes and push them to your forked repository.
4. Create a pull request from your forked repository to the main project repository.

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.