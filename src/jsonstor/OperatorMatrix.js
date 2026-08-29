'use strict';

const jsongin = require( '@liquicode/jsongin' );

/*
	What every registered translator does with every jsongin query operator.

	***One table, operator-major.*** One row per jsongin query operator, one column per
	registered translator. It replaces the per-dialect predicate inventories which
	jsonx/.plans/sql-adapter-architecture.md originally proposed: a per-dialect file cannot
	answer "what does every backend do with $regex" without reading N of them, and the
	assertion that every jsongin operator is classified stops being structural the moment
	there is more than one file to look in.

	***jsonstor owns the rows; each translator owns its column.*** The rows are not written
	down here at all - they are read from jsongin.QueryOperators, so the row set cannot drift
	from the engine it describes and a new operator in jsongin appears here the day it lands.
	A translator declares its own Fidelities and contributes its column when it registers,
	which is what keeps a new target a new package rather than a jsonstor release.

	***A cell is a fidelity, not a yes or no:***

		exact       The pushdown decides this condition by itself. ***Only an exact cell lets
		            an operator leave the residual.***
		broadening  The pushdown renders it, but may admit rows the criteria rejects, so
		            jsongin still has to decide. A projected column broadened under F4 is the
		            standing example: it renders perfectly and settles nothing.
		dropped     Not rendered at all. The clause is silent and every row travels.

	***A cell is a ceiling, not a measurement.*** It declares the ***best achievable***
	fidelity; the renderer reports the ***actual*** one, which depends on the operand and the
	column and not on the operator alone - `$eq: 10` is exact against an INTEGER column and
	broadening against a TEXT one. A translator may never claim better at runtime than its
	cell allows.

	***Anything undeclared is `dropped`***, which is the safe default: it says the translator
	absorbs nothing, which is always correct and merely slow. A translator that declares no
	Fidelities at all works, and is simply never trusted to narrow anything.
*/

module.exports = function ( jsonstor )
{

	// In order of decreasing trust. A translator may declare no better than its cell.
	const FIDELITIES = [ 'exact', 'broadening', 'dropped' ];


	//---------------------------------------------------------------------
	// The rows. Read from jsongin rather than written down, so they cannot drift.
	function Operators()
	{
		return Object.keys( jsongin.QueryOperators );
	}


	//---------------------------------------------------------------------
	// One cell. Undeclared is 'dropped' - see the header.
	function Fidelity( TranslatorName, OperatorName )
	{
		let translator = jsonstor.Translators[ TranslatorName ];
		if ( !translator ) { throw new Error( `Criteria translator [${TranslatorName}] is not loaded.` ); }
		if ( !translator.Fidelities ) { return 'dropped'; }
		let declared = translator.Fidelities[ OperatorName ];
		if ( FIDELITIES.indexOf( declared ) < 0 ) { return 'dropped'; }
		return declared;
	}


	//---------------------------------------------------------------------
	// The whole table, ready to render or to assert against.
	//
	// Cells is keyed by operator and then by translator, because every caller so far reads a
	// row - "what does each backend do with this operator" is the question the shape is for.
	function Matrix()
	{
		let operators = Operators();
		let translators = Object.keys( jsonstor.Translators );
		let cells = {};
		for ( let index = 0; index < operators.length; index++ )
		{
			let operator = operators[ index ];
			cells[ operator ] = {};
			for ( let t = 0; t < translators.length; t++ )
			{
				cells[ operator ][ translators[ t ] ] = Fidelity( translators[ t ], operator );
			}
		}
		return {
			Operators: operators,
			Translators: translators,
			Cells: cells,
		};
	}


	//---------------------------------------------------------------------
	// Every operator a translator will not decide by itself.
	//
	// ***This is the residual question asked of the vocabulary rather than of a criteria.***
	// A translator whose list is empty could absorb any criteria entirely; one which names an
	// operator can never return an empty residual for a criteria using it. Nothing narrows a
	// residual on this alone - a rendering still has to report what it actually did - but it
	// is what makes an empty residual arguable at all.
	function NotExact( TranslatorName )
	{
		let operators = Operators();
		let found = [];
		for ( let index = 0; index < operators.length; index++ )
		{
			if ( Fidelity( TranslatorName, operators[ index ] ) !== 'exact' ) { found.push( operators[ index ] ); }
		}
		return found;
	}


	return {
		FIDELITIES: FIDELITIES,
		Operators: Operators,
		Fidelity: Fidelity,
		Matrix: Matrix,
		NotExact: NotExact,
	};
};
