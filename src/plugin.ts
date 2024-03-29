import type * as ts from "typescript/lib/tsserverlibrary"
import { ACTIONS, refactorName } from './const'
import tsModule from 'typescript/lib/tsserverlibrary';

export default class LspPlugin {
  private info?: ts.server.PluginCreateInfo
  constructor(private readonly typescript: typeof ts) { }

  log(info: any) {
    this.info?.project.projectService.logger.info('[**lsp-box**]: ' + JSON.stringify(info))
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

  getRefactorContext(fileName: string) {
    const program = this.info?.languageService.getProgram()
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

  initLanguageVerifyConfig(config) {
    return {
      ignoreFilePatterns: config.ignoreFilePatterns || [],
      commentSwitch: {
        enabled: !!config.commentOn,
        on: config.commentOn,
        off: config.commentOff
      }
    }
  }

  create(info: ts.server.PluginCreateInfo) {
    this.info = info
    const getSuggestionDiagnostics = info.languageService.getSuggestionDiagnostics
    const languageVerifyConfig = this.initLanguageVerifyConfig(info.config.languageVerify || {})
    this.log(languageVerifyConfig)
    if (info.languageServiceHost.resolveModuleNames) {
      const _resolveModuleNames =
        info.languageServiceHost.resolveModuleNames.bind(
          info.languageServiceHost,
        );

      info.languageServiceHost.resolveModuleNames = (
        moduleNames,
        containingFile,
        ...rest
      ) => {
        const resolvedModules = _resolveModuleNames(
          moduleNames,
          containingFile,
          ...rest,
        );

        return moduleNames.map((moduleName, index) => {
          const pat = /^\w+-loader!/
          if (pat.test(moduleName)) {
            let a = info.project.getResolvedModuleWithFailedLookupLocationsFromCache(
              moduleName,
              containingFile,
            );
            moduleName = moduleName.replace(pat, '')
            const resolvedModules = _resolveModuleNames([moduleName], containingFile, ...rest)
            return resolvedModules[0]
          }
          return resolvedModules[index]
        })
      }
    }
    return {
      ...info.languageService,
      // 禁止使用中文字符串
      getSuggestionDiagnostics: (fileName) => {
        const context = this.getRefactorContext(fileName)
        if (!context) {
          this.log("Cannot construct refactor context")
          return undefined
        }
        const { file } = context
        const myDiag: ts.DiagnosticWithLocation[] = []
        const pat = new RegExp("[\u4E00-\u9FA5]+")
        let langOn = true
        let travel = (node: ts.Node) => {
          if (languageVerifyConfig.commentSwitch.enabled) {
            const commentRange = this.typescript.getLeadingCommentRanges(file.getFullText(), node.getFullStart())?.[0]
            if (commentRange) {
              if (file.getFullText().slice(commentRange.pos, commentRange.end).includes(languageVerifyConfig.commentSwitch.on)) langOn = true
              if (file.getFullText().slice(commentRange.pos, commentRange.end).includes(languageVerifyConfig.commentSwitch.off)) langOn = false
            }
          }
          const isIgnore = languageVerifyConfig.ignoreFilePatterns.some(_ => file.path.includes(_))
          const isConsoleExpression = this.typescript.isCallExpression(node.parent) &&
            this.typescript.isPropertyAccessExpression(node.parent.getChildAt(0)) &&
            node.parent.getChildAt(0).getText().indexOf('console.') === 0
          if(langOn && !isIgnore &&
            (this.typescript.isJsxText(node) || (this.typescript.isStringLiteral(node)) && !isConsoleExpression) &&
            pat.test(node.text)) {
            myDiag.push(this.typescript.createDiagnosticForNode(node, {
              message: '不能使用中文',
              key: 'key',
              category: this.typescript.DiagnosticCategory.Error,
              code: 11222
            }))
          } else {
            this.typescript.forEachChild(node, travel)
          }
        }
        this.typescript.forEachChild(file, travel)
        let diagnostics = getSuggestionDiagnostics(fileName)
        return diagnostics.concat(myDiag)
      },
      getApplicableRefactors: (fileName: string, positionOrRange: number | ts.TextRange) => {
        const context = this.getRefactorContext(fileName)
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
        const context = this.getRefactorContext(fileName)
        if (!context) {
          this.log("Cannot construct refactor context")
          return undefined
        }

        const { file, checker } = context
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

        // 添加光标下的标识符作为函数参数
        if (ACTIONS.AddFunctionParameter.info.name === actionName && ACTIONS.AddFunctionParameter.match(ts, currentToken)) {
          return {
            edits: this.typescript.textChanges.ChangeTracker.with(textChangesContext, function(changeTracker) {
              const functionDeclaration = ACTIONS.AddFunctionParameter.matchReturnNode(ts, currentToken) as ts.FunctionDeclaration
              const parameter = ts.factory.createParameterDeclaration(undefined, undefined, undefined, currentToken.escapedText.toString(), undefined, undefined)
              changeTracker.replaceNode(file, functionDeclaration, ts.updateFunctionDeclaration(functionDeclaration, undefined, undefined, undefined, functionDeclaration.name, undefined, [...functionDeclaration.parameters, parameter], undefined, functionDeclaration.body))
            })
          }
        }

        // 给变量添加值注释
        if (ACTIONS.AddValueComment.info.name === actionName && ACTIONS.AddValueComment.match(ts, currentToken)) {
          const pos = this.getPositionOfPositionOrRange(positionOrRange)
          let token = this.getTargetInfo(file, pos)
          this.log(token.getText())
          if (token.parent.getChildAt(0) === token) {
            token = token.parent.getChildAt(2)
          }
          this.log(token.getText())
          let s = checker.getSymbolAtLocation(token)
          if (s) {
            const varDecl = s.getDeclarations()![0]
            // varDecl.getText() 返回 checkRecord: '查看记录详情'
            const comment = varDecl?.getText().split(/:\s?/)[1].replace(/^'|'$/g, '') || ''
            return {
              edits: this.typescript.textChanges.ChangeTracker.with(textChangesContext, function(changeTracker) {
                changeTracker.replaceNode(file, token, ts.addSyntheticTrailingComment(token, ts.SyntaxKind.MultiLineCommentTrivia, comment, false))
              })
            }
          }
        }
      }
    }
  }
}
