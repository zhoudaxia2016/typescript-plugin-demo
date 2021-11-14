import type * as ts from "typescript/lib/tsserverlibrary"
import 'open-typescript'
import { ACTIONS, refactorName } from './const'

export default class StringLiteralEnumPlugin {
  private info?: ts.server.PluginCreateInfo
  constructor(private readonly typescript: typeof ts) { }

  log(info: any) {
    this.info?.project.projectService.logger.info('[**MyTsPlugin**]: ' + JSON.stringify(info))
  }

  getTargetInfo(
    file: ts.SourceFile,
    pos: number
  ) {
    const ts = this.typescript

    const currentToken = ts.getTokenAtPosition(file, pos)
    return currentToken
  }

  getPositionOfPositionOrRange(
    positionOrRange: number | ts.TextRange
  ) {
    return typeof positionOrRange === "number"
      ? positionOrRange
      : positionOrRange.pos
  }

  getRefactorContext(fileName: string, info: ts.server.PluginCreateInfo) {
    const program = info.languageService.getProgram()
    if (!program) {
      this.log("Cannot find program")
      return undefined
    }
    const checker = program.getTypeChecker()

    const file = program.getSourceFile(fileName)
    if (!file) {
      this.log("Cannot find source file")
      return undefined
    }

    return {
      file,
      program,
      checker
    }
  }

  create(info: ts.server.PluginCreateInfo) {
    this.info = info
    return {
      ...info.languageService,
      getApplicableRefactors: (fileName: string, positionOrRange: number | ts.TextRange) => {
        const context = this.getRefactorContext(fileName, info)
        if (!context) {
          this.log("Cannot construct refactor context")
          return undefined
        }
        const { file } = context
        // 获取当前节点
        const currentToken = this.getTargetInfo(file, this.getPositionOfPositionOrRange(positionOrRange))
        return [
          {
            name: refactorName,
            description: 'MyTsPlugin desc',
            actions: Object.values(ACTIONS).filter(_ => !!_.match(this.typescript, currentToken)).map(_ => _.info)
          }
        ]
      },
      getEditsForRefactor: (fileName: string, formatOptions: ts.FormatCodeSettings, positionOrRange: number | ts.TextRange, refactor: string, actionName: string, preferences: ts.UserPreferences) => {
        if (refactorName !== refactor) return
        // 初始化上下文，暂时不知道有什么用，传就是
        const formatContext = this.typescript.formatting.getFormatContext(
          formatOptions,
          info.languageServiceHost
        )
        const textChangesContext: ts.textChanges.TextChangesContext = {
          formatContext,
          host: info.languageServiceHost,
          preferences: preferences || {}
        }
        const context = this.getRefactorContext(fileName, info)
        if (!context) {
          this.log("Cannot construct refactor context")
          return undefined
        }

        const { file } = context
        // 获取当前节点
        const currentToken = this.getTargetInfo(file, this.getPositionOfPositionOrRange(positionOrRange))
        this.log('kindkind: ' + currentToken.kind)
        const ts = this.typescript

        // 将函数表达式转换成箭头函数
        if (ACTIONS.FunctionExpressionToArrowFunction.info.name === actionName && ACTIONS.FunctionExpressionToArrowFunction.match(ts, currentToken)) {
          return {
            edits: this.typescript.textChanges.ChangeTracker.with(textChangesContext, function(changeTracker) {
              changeTracker.replaceNode(file, currentToken.parent, ts.factory.createArrowFunction(undefined, undefined, currentToken.parent.parameters, undefined, undefined, currentToken.parent.body))
            })
          }
        }

        // 简单测试 修改标识符名字
        if (ACTIONS.ChangeIdentifierName.info.name === actionName && ACTIONS.ChangeIdentifierName.match(ts, currentToken)) {
          return {
            edits: this.typescript.textChanges.ChangeTracker.with(textChangesContext, function(changeTracker) {
              changeTracker.replaceNode(file, currentToken, ts.createIdentifier('hello'))
            })
          }
        }

        if (ACTIONS.AddFunctionParameter.info.name === actionName && ACTIONS.AddFunctionParameter.match(ts, currentToken)) {
          return {
            edits: this.typescript.textChanges.ChangeTracker.with(textChangesContext, function(changeTracker) {
              // TODO 删除as
              const functionDeclaration = ACTIONS.AddFunctionParameter.matchReturnNode(ts, currentToken) as ts.FunctionDeclaration
              const parameter = ts.factory.createParameterDeclaration(undefined, undefined, undefined, currentToken.escapedText.toString(), undefined, undefined)
              changeTracker.replaceNode(file, functionDeclaration, ts.updateFunctionDeclaration(functionDeclaration, undefined, undefined, undefined, functionDeclaration.name, undefined, [...functionDeclaration.parameters, parameter], undefined, functionDeclaration.body))
            })
          }
        }
      }
    }
  }
}
