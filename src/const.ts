import type * as ts from "typescript/lib/tsserverlibrary"
import 'open-typescript'

function matchReturnNode(typescript: typeof ts, token: ts.Node) {
  if (typescript.isIdentifier(token))
    return typescript.findAncestor(token, typescript.isFunctionDeclaration)
}

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
  },
  AddFunctionParameter: {
    match(typescript: typeof ts, token: ts.Node): token is ts.Identifier {
      return !!matchReturnNode(typescript, token)
    },
    matchReturnNode,
    info: {
      name: 'Add a parameter for the function',
      description: 'Add a parameter for the function'
    }
  },
  ConvertRequireToImport: {
    match(typescript: typeof ts, token: ts.Node): ts.CallExpression | undefined {
      if (typescript.isIdentifier(token) || typescript.isStringLiteral(token)) {
        if (token.parent && typescript.isRequireCall(token.parent, true))
          return token.parent
      }
    },
    info: {
      name: 'ConvertRequireToImport',
      description: 'Convert a require call to import declaration'
    }
  }
}

export const refactorName = 'MyTsPluginRefactor'
