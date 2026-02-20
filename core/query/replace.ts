import {
	isFragmentEquals,
	TAnyFragment,
	TBatchStatement,
	TDeleteStatement,
	TInsertStatement,
	TJoinFragment,
	TSelectStatement,
	TUpdateStatement,
} from "./schema.ts";
import { visit } from "./visit.ts";

export function replace(search: TAnyFragment, replacer: <T extends TAnyFragment>(node: T) => T | undefined): TAnyFragment {
	return visit<TAnyFragment, void>(search, {
		visitLiteral: (node) => replacer(node) ?? node,
		visitNamedFunctionReference: (node) => replacer(node) ?? node,
		visitTableReference: (node) => replacer(node) ?? node,
		visitColumnReference: (node) => replacer(node) ?? node,
		visitNamedParamReference: (node) => replacer(node) ?? node,
		visitBooleanExpression: (node) => replacer(node) ?? node,
		visitBooleanComparisonExpression: (node) => replacer(node) ?? node,
		visitSelectStatement: (node, visit) => {
			node = replacer(node) ?? node;
			const replaced = {
				type: "select",
				from: visit(node.from) as never,
				join: node.join.map((j) => visit(j)) as never,
				select: Object.fromEntries(
					Object.entries(node.select).map(([key, value]) => [key, visit(value)]),
				) as never,
				where: node.where ? visit(node.where) as never : undefined,
				groupBy: node.groupBy.map((g) => ({
					column: visit(g.column),
				})) as never,
				orderBy: node.orderBy.map((o) => ({
					column: visit(o.column),
					order: o.order,
				})) as never,
				limit: node.limit,
				offset: node.offset,
			} satisfies TSelectStatement;
			if (isFragmentEquals(node, replaced)) {
				return node;
			}
			return replaced;
		},
		visitInsertStatement: (node, visit) => {
			node = replacer(node) ?? node;
			const replaced = {
				type: "insert",
				into: visit(node.into) as never,
				columns: node.columns,
				from: node.from ? visit(node.from) as never : undefined,
				values: node.values
					? node.values.map((v) => Object.fromEntries(Object.entries(v).map(([key, value]) => [key, visit(value)]))) as never
					: undefined,
			} satisfies TInsertStatement;
			if (isFragmentEquals(node, replaced)) {
				return node;
			}
			return replaced;
		},
		visitUpdateStatement: (node, visit) => {
			node = replacer(node) ?? node;
			const replaced = {
				type: "update",
				table: visit(node.table) as never,
				set: Object.fromEntries(
					Object.entries(node.set).map(([key, value]) => [key, visit(value)]),
				) as never,
				where: node.where ? visit(node.where) as never : undefined,
				join: node.join.map((j) => visit(j)) as never,
			} satisfies TUpdateStatement;
			if (isFragmentEquals(node, replaced)) {
				return node;
			}
			return replaced;
		},
		visitDeleteStatement: (node, visit) => {
			node = replacer(node) ?? node;
			const replaced = {
				type: "delete",
				table: visit(node.table) as never,
				where: node.where ? visit(node.where) as never : undefined,
				join: node.join.map((j) => visit(j)) as never,
			} satisfies TDeleteStatement;
			if (isFragmentEquals(node, replaced)) {
				return node;
			}
			return replaced;
		},
		visitBatchStatement: (node, visit) => {
			node = replacer(node) ?? node;
			const replaced = {
				type: "batch",
				checks: node.checks.map((c) => visit(c)) as never,
				statements: node.statements.map((s) => visit(s)) as never,
			} satisfies TBatchStatement;
			if (isFragmentEquals(node, replaced)) {
				return node;
			}
			return replaced;
		},
		visitJoinFragment: (node, visit) => {
			node = replacer(node) ?? node;
			const replaced = {
				type: "join",
				table: node.table,
				alias: node.alias,
				on: node.on ? visit(node.on) as never : undefined,
			} satisfies TJoinFragment;
			if (isFragmentEquals(node, replaced)) {
				return node;
			}
			return replaced;
		},
		visitCheck: (node, visit) => {
			node = replacer(node) ?? node;
			const replaced = {
				type: node.type,
				select: visit(node.select) as never,
			};
			if (isFragmentEquals(node, replaced)) {
				return node;
			}
			return replaced;
		},
	}, void 0)!;
}
