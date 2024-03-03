'use strict';

module.exports = {

	Context:{
		Package: require( '../package.json' ),
		AWS_ProfileName: 'admin',
		AWS_BucketName: 'jsonstor.liquicode.com',
	},

	run_tests: [

		// Run tests and capture the output.
		{
			$Shell: {
				command: 'npx mocha -u bdd test/*.js --timeout 0 --slow 10',
				out: { filename: 'tests.md' },
				err: { console: true },
			}
		},
		{ $PrependTextFile: { filename: 'tests.md', value: '```\n' } },
		{ $AppendTextFile: { filename: 'tests.md', value: '```\n' } },

	],

	build_docs: [

		// // Generate: Command Reference.md
		// {
		// 	$ExecuteEjs: {
		// 		ejs_file: 'docs/templates/Command Reference.md',
		// 		use_eval: true,
		// 		out: { filename: 'docs/guides/Command Reference.md' },
		// 	}
		// },

		// Generate: readme.md
		{
			$ExecuteEjs: {
				ejs_file: 'docs/templates/readme.md',
				use_eval: true,
				// debug_script: { filename: 'docs/templates/readme.md.script.js' },
				out: { filename: 'docs/external/readme.md' },
			}
		},
		{ $CopyFile: { from: 'docs/external/readme.md', to: 'readme.md' } },

		// Generate: version.md
		{
			$ExecuteEjs: {
				ejs_string: '<%- Context.Package.version %>',
				use_eval: true,
				out: { filename: 'docs/external/version.md' },
			}
		},
		{ $CopyFile: { from: 'docs/external/version.md', to: 'version.md' } },

		// Copy other files to the docs external area.
		{ $EnsureFolder: { folder: 'docs/external' } },
		{ $CopyFile: { from: 'license.md', to: 'docs/external/license.md' } },
		{ $CopyFile: { from: 'history.md', to: 'docs/external/history.md' } },
		{ $CopyFile: { from: 'tests.md', to: 'docs/external/tests.md' } },

	],

	run_webpack: [

		// Run webpack.
		{
			$Shell: {
				command: 'npx webpack-cli --config build/webpack.config.js',
				out: { console: true },
				err: { console: true },
				halt_on_error: false
			}
		},

	],

	update_aws_docs: [

		// Update aws s3 bucket with package docs.
		{
			$Shell: {
				command: 'set "AWS_PROFILE=${AWS_ProfileName}" & aws s3 sync docs s3://${AWS_BucketName}',
				out: { console: true },
				err: { console: true },
			},
		},

	],

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
		{ $RunTask: { task: 'run_tests' } },
		{ $RunTask: { task: 'build_docs' } },
		{ $RunTask: { task: 'update_aws_docs' } },
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

		// Rebuild the docs.
		{ $RunTask: { task: 'build_docs' } },

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
