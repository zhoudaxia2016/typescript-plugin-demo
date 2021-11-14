import type * as ts from "typescript/lib/tsserverlibrary"
import 'open-typescript'
export const ACTIONS = {
  FunctionExpressionToArrowFunction: {
    match(typescript: typeof ts, token: ts.Node): token is { parent: ts.FunctionExpression } & ts.Node {
      return token.parent && typescript.isFunctionExpression(token.parent)
    },
    info: {
      name: 'Function Expression to Arrow Function',
      description: 'Transform a function expression to a arrow function'
    }
  },
  ChangeIdentifierName: {
    match(typescript: typeof ts, token: ts.Node) {
      return typescript.isIdentifier(token)
    },
    info: {
      name: 'Change Identifier name',
      description: 'Change Identifier name'
    }
  }
}

export const refactorName = 'MyTsPluginRefactor'
