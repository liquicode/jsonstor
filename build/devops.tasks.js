'use strict';

module.exports = {

	run_tests: [

		// Run tests and capture the output.
		{ $Shell: { command: 'npx mocha -u bdd test/*.js --timeout 0 --slow 10', output: 'tests.md' } },
		{ $PrependTextFile: { filename: 'tests.md', value: '```\n' } },
		{ $AppendTextFile: { filename: 'tests.md', value: '```\n' } },

	],

	sync_version: [

		// Read the package file.
		{ $ReadJsonFile: { filename: 'package.json', context: 'Package' } },

		// Update files with the current version.
		{ $ReplaceFileText: { filename: 'version.md', value: '${Package.version}' } },
		{ $ReplaceFileText: { filename: 'readme.md', start_text: '(v', end_text: ')', value: '${Package.version}' } },
		{ $ReplaceFileText: { filename: 'docs/_coverpage.md', start_text: '(v', end_text: ')', value: '${Package.version}' } },

	],

	build_docs: [

		// Copy files to the docs external area.
		{ $EnsureFolder: { folder: 'docs/external' } },
		{ $CopyFile: { from: 'readme.md', to: 'docs/external/readme.md' } },
		{ $CopyFile: { from: 'license.md', to: 'docs/external/license.md' } },
		{ $CopyFile: { from: 'version.md', to: 'docs/external/version.md' } },
		{ $CopyFile: { from: 'hitory.md', to: 'docs/external/hitory.md' } },
		{ $CopyFile: { from: 'tests.md', to: 'docs/external/tests.md' } },

	],

	run_webpack: [

		// Run webpack.
		{
			$Shell: {
				command: 'npx webpack-cli --config build/webpack.config.js',
				output: 'console', errors: 'console', halt_on_error: false
			}
		},

	],

	update_aws_docs: [

		// Update aws s3 bucket with package docs.
		{ $Shell: { command: 'set "AWS_PROFILE=admin" & aws s3 sync docs s3://jsonstor.liquicode.com' } },

	],

	npm_publish_version: [

		// Update npmjs.com with new package.
		{
			$Shell: {
				command: 'npm publish . --access public',
				// output: 'console', errors: 'console', halt_on_error: false
				halt_on_error: false
			}
		},

	],

	git_publish_version: [

		// Read the package file.
		{ $ReadJsonFile: { filename: 'package.json', context: 'Package' } },

		// Update github and finalize the version.
		{
			$Shell: {
				command: 'git add .',
				output: 'console', errors: 'console', halt_on_error: false
			}
		},
		{
			$Shell: {
				command: 'git commit --quiet -m "Finalization for v${Package.version}"',
				output: 'console', errors: 'console', halt_on_error: false
			}
		},
		{
			$Shell: {
				command: 'git push --quiet origin main',
				output: 'console', errors: 'console', halt_on_error: false
			}
		},
		// Tag the existing version
		{
			$Shell: {
				command: 'git tag -a v${Package.version} -m "Version v${Package.version}"',
				output: 'console', errors: 'console', halt_on_error: false
			}
		},
		{
			$Shell: {
				command: 'git push --quiet origin v${Package.version}',
				output: 'console', errors: 'console', halt_on_error: false
			}
		},

	],

	publish_version: [

		// Read the package file.
		{ $ReadJsonFile: { filename: 'package.json', context: 'Package' } },

		// Finalize and publish the existing version.
		{ $RunTask: { name: 'run_tests' } },
		{ $RunTask: { name: 'sync_version' } },
		{ $RunTask: { name: 'build_docs' } },
		{ $RunTask: { name: 'run_webpack' } },
		{ $RunTask: { name: 'update_aws_docs' } },
		{ $RunTask: { name: 'git_publish_version' } },
		// { $RunTask: { name: 'npm_publish_version' } },

	],

	start_new_version: [

		// Read the package file.
		{ $ReadJsonFile: { filename: 'package.json', context: 'Package' } },

		// Increment and update the official package version.
		{ $SemverInc: { context: 'Package.version' } },
		{ $WriteJsonFile: { filename: 'package.json', context: 'Package', friendly: true } },

		// Sync the version again.
		{ $RunTask: { name: 'sync_version' } },

		// Update github with the new version.
		{
			$Shell: {
				command: 'git add .',
				output: 'console', errors: 'console', halt_on_error: false
			}
		},
		{
			$Shell: {
				command: 'git commit --quiet -m "Initialization for v${Package.version}"',
				output: 'console', errors: 'console', halt_on_error: false
			}
		},
		{
			$Shell: {
				command: 'git push --quiet origin main',
				output: 'console', errors: 'console', halt_on_error: false
			}
		},

	],

};
