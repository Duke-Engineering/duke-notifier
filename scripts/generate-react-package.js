#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Create the dist/react directory if it doesn't exist
const reactDistDir = path.join(__dirname, '../dist/react');
if (!fs.existsSync(reactDistDir)) {
  fs.mkdirSync(reactDistDir, { recursive: true });
}

// Create the package.json for the react subpath
const reactPackageJson = {
  main: './index.js',
  types: './index.d.ts',
};

// Write the package.json file
const packageJsonPath = path.join(reactDistDir, 'package.json');
fs.writeFileSync(packageJsonPath, JSON.stringify(reactPackageJson, null, 2) + '\n');

console.log('✓ Generated dist/react/package.json');
