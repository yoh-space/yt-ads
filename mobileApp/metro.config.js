const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

// Watch the repo root so Metro can bundle files outside mobileApp/
// (root convex/_generated/* and src/lib/* shared modules).
config.watchFolders = [workspaceRoot];

// Resolve node_modules for both the mobile app and the shared modules.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

module.exports = config;