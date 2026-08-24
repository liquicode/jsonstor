'use strict';

module.exports = {

	Context: {
		Package: require( '../package.json' ),
	},

	run_tests: [

		// Run the unit tests and the jsonstor parity inventory.
		//
		// A gate, not a report. tests.md is written by jsonstor-docs/build/run-all-tests.js,
		// which runs this same command through the workspace and gathers every member's
		// result into one place. Writing it here too would give the file two authors.
		{
			$Shell: {
				command: 'node build/run-tests.js',
				out: { console: true },
				err: { console: true },
			}
		},

	],

	// build_docs lives in jsonstor-docs now.
	//
	// The site, the templates, and docs-check.js moved there so that the whole family's
	// documentation is built in one pass. readme.md and version.md in this repository are
	// generated output of that build - edit docs/templates/readme.md in jsonstor-docs.
	//
	// Run 'npm run "build docs" -w jsonstor-docs.git' before publishing this package.

	run_webpack: [

		// Run webpack.
		// Halts on error. This is the first step of publish_version, so a bundle which
		// fails to build must stop the release rather than let the previous bundle ship
		// against a new version number.
		{
			$Shell: {
				command: 'npx webpack-cli --config build/webpack.config.js',
				out: { console: true },
				err: { console: true },
			}
		},

	],

	// update_aws_docs lives in jsonstor-docs now, along with the site it syncs.

	npm_publish_version: [

		// Update npmjs.com with new package.
		{
			$Shell: {
				command: 'npm publish . --access public',
				// output: 'console', errors: 'console', halt_on_error: false
				out: { console: true },
				err: { console: true },
				halt_on_error: false
			}
		},

	],

	git_publish_version: [

		// Update github and finalize the version.
		{
			$Shell: {
				command: 'git add .',
				out: { console: true },
				err: { console: true },
				halt_on_error: false
			}
		},
		{
			$Shell: {
				command: 'git commit --quiet -m "Finalization for v${Package.version}"',
				out: { console: true },
				err: { console: true },
				halt_on_error: false
			}
		},
		{
			$Shell: {
				command: 'git push --quiet origin main',
				out: { console: true },
				err: { console: true },
				halt_on_error: false
			}
		},
		// Tag the existing version
		{
			$Shell: {
				command: 'git tag -a v${Package.version} -m "Version v${Package.version}"',
				out: { console: true },
				err: { console: true },
				halt_on_error: false
			}
		},
		{
			$Shell: {
				command: 'git push --quiet origin v${Package.version}',
				out: { console: true },
				err: { console: true },
				halt_on_error: false
			}
		},

	],

	publish_version: [

		// Finalize and publish the existing version.
		{ $RunTask: { task: 'run_webpack' } },
		{ $RunTask: { task: 'run_tests' } },
		{ $RunTask: { task: 'git_publish_version' } },
		{ $RunTask: { task: 'npm_publish_version' } },

	],

	start_new_version: [

		// Increment and update the official package version.
		{ $SemverInc: { context: 'Package.version' } },
		{
			$PrintContext: {
				context: 'Package',
				out: { as: 'json-friendly', filename: 'package.json' },
			}
		},

		// Reload the package file.
		{
			$ReadJsonFile: {
				filename: 'package.json',
				out: { context: 'Package' },
			}
		},

		// Update github with the new version.
		{
			$Shell: {
				command: 'git add .',
				out: { console: true },
				err: { console: true },
				halt_on_error: false
			}
		},
		{
			$Shell: {
				command: 'git commit --quiet -m "Initialization for v${Package.version}"',
				out: { console: true },
				err: { console: true },
				halt_on_error: false
			}
		},
		{
			$Shell: {
				command: 'git push --quiet origin main',
				out: { console: true },
				err: { console: true },
				halt_on_error: false
			}
		},

	],

};
