const LIB_PATH = require( 'path' );


module.exports =
{
	// Resolve everything from the repository root rather than from wherever the build was
	// started. jsonstor-docs builds this bundle by naming this file across the workspace,
	// and webpack's context otherwise defaults to the caller's working folder - which made
	// `./src/jsonstor.js` resolve inside jsonstor-docs.
	context: LIB_PATH.resolve( __dirname, '..' ),

	entry: './src/jsonstor.js',
	mode: 'production',
	output: {
		path: __dirname,
		filename: `../dist/jsonstor.min.js`,

		library: 'jsonstor',
		libraryTarget: 'umd',

		// Fix to get umd to work; see: https://github.com/webpack/webpack/issues/6784
		globalObject: 'typeof self !== \'undefined\' ? self : this',

	},

	// This bundle is the browser artifact. It was previously built with target: 'node' and
	// webpack-node-externals, which is wrong for a file served to a browser: the externals
	// left `require("fs")` and `require("@liquicode/jsongin")` in the output, so every
	// published dist/jsonstor.min.js throws `require is not defined` on load. jsongin's
	// config had the same defect and was corrected the same way.
	target: 'web',

	resolve: {
		// The Node built-ins are reached by the jsonfile and folder adapters only, and only
		// once one of them is constructed. `false` supplies an empty module, so requiring it
		// at the top of a file costs nothing and the memory adapter - the one a browser can
		// actually run - is unaffected. Bundling a shim instead would imply those two
		// adapters work in a browser, and they do not.
		//
		// `lockfile` is a declared dependency which nothing under src/ requires; it is listed
		// here so that reinstating a use of it fails the build rather than the browser.
		fallback: {
			fs: false,
			path: false,
			lockfile: false,
		},
	},
};
