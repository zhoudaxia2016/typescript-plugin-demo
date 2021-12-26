import type * as ts from "typescript/lib/tsserverlibrary"

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
  AddValueComment: {
    match(typescript: typeof ts, token: ts.Node): token is ts.Identifier {
      return typescript.isIdentifier(token) && token.parent && typescript.isPropertyAccessExpression(token.parent) && token.parent.getChildAt(0).getText() === 'lang'
    },
    info: {
      name: 'Add comment for identifier value',
      description: 'Add comment for identifier value'
    }
  }
}

export const refactorName = 'MyTsPluginRefactor'
