# typescript plugin demo

> `demo`在`neovim`和`vscode`都能顺利运行，因为本人vscode使用经验较少，可能`vscode`有些地方描述不对，或者使用上的问题都欢迎探讨。

## 术语：
`lsp`: 微软定义的语言服务协议，[https://microsoft.github.io/language-server-protocol/specifications/specification-current](https://microsoft.github.io/language-server-protocol/specifications/specification-current/)

`tsserver`: vscode背后提供智能编辑体验的服务器，[https://github.com/microsoft/TypeScript/wiki/Standalone-Server-%28tsserver%29](https://github.com/microsoft/TypeScript/wiki/Standalone-Server-%28tsserver%29)

`typescript plugin`: tsserver插件，可以用来扩展编辑器服务，比如补全，refactor，[https://github.com/microsoft/TypeScript/wiki/Writing-a-Language-Service-Plugin](https://github.com/microsoft/TypeScript/wiki/Writing-a-Language-Service-Plugin)，可以在tsconfig配置，[https://www.typescriptlang.org/tsconfig#plugins](https://www.typescriptlang.org/tsconfig#plugins)，然后npm安装到vscode语言服务插件目录，我的是在`E:\app\Microsoft VS Code\resources\app\extensions\typescript-language-features\node_modules`

`refactor`: 重构，这里指的不是大范围的重构，指的是比较小的操作。比如将箭头函数改成函数表达式，将某段if代码改成swith。

## 开发参考资源

1. 入门认识，[https://juejin.cn/post/6942380528456695844](https://juejin.cn/post/6942380528456695844)
2. [typescript ast查看器](https://astexplorer.net/)
3. 可以参考[typescript-transformer](https://github.com/madou/typescript-transformer-handbook#adding-new-import-declarations)，因为原理基本一样，通过操作`ast`实现

## 开发简单文档

### lsp基本原理

编辑器前端收到用户的需要语法解析的编辑操作（比如跳转定义，补全）
编辑器前端按照`lsp`标准发请求给`lsp`后端（`vscode`的`lsp`后端是`tsserver`）
lsp后端收到并分析返回结果（比如得到补全列表，得到定义位置）
编辑器前端通过自己的ui系统展示结果，并等待用户其他操作


lsp的意义在于让编辑器插件变得通用。比如要为`neovim`，`vscode`，`sublime`，`atom`写`typescript`,`python`，`c++`插件，我们要写`3*3`一共9个。
使用lsp编写的插件只需要`3+3`一共6个。用时间复杂度来说就是：
n为编辑器数量，m为语言数量，使用lsp将插件数量从`n*m`减少到了`n+m`


为什么是`n+m`呢？
因为`lsp`其实是一个前后端分离的架构，需要实现n个编辑器前端插件和m个语言服务插件。

### 简单例子
```Typescript
function init(modules: { typescript: typeof import("typescript/lib/tsserverlibrary") }) {
  const ts = modules.typescript;

  function create(info: ts.server.PluginCreateInfo) {
    // Set up decorator object
    const proxy: ts.LanguageService = Object.create(null);
    for (let k of Object.keys(info.languageService) as Array<keyof ts.LanguageService>) {
      const x = info.languageService[k]!;
      // @ts-expect-error - JS runtime trickery which is tricky to type tersely
      proxy[k] = (...args: Array<{}>) => x.apply(info.languageService, args);
    }
    return { create };
  }
}
```
`info.LanguageService`是服务器暴露给我们的api，当编辑器访问一些功能时会调用，比如获取补全列表，获取可以重构提示，跳转定义等。可以跳转到它的类型定义了解更多。
[info.LanguageService定义位置](https://github.com/microsoft/TypeScript/blob/7f004ad8dfd4d3aa047173a890c0beaeb8a307de/lib/tsserverlibrary.d.ts#L4898)
简单介绍一些api：
`getApplicableRefactors`: 获取重构提示，即是返回一些重构操作的选项，供用户选择。`vscode`可以按`ctrl+shift+R`来弹出这个菜单，
或者点击代码行左边的小灯泡，都会请求服务器，服务器会执行这个api。
`getEditsForRefactor`: 上一步获取到重构操作的名字，当用户确定要执行这个操作时，会请求服务器，然后服务器执行这个api获取重构操作具体要干什么返回编辑器。
`getCompletionsAtPosition`: api补全菜单的获取需要这个

以上的代码例子意思是说可以通过代理这些api来扩展我们需要的操作。我们可以先获取原始api的结果，然后做修改，或者添加。或者不使用原始api的结果，用我们自己的方法。

### 简单编写流程
我们代理这些api后，具体要怎么做才能得到结果呢？一般的流程是：

1. 我们编辑的时候，发现了一个不舒服的地方，比如有时我们写了一个`React functional component`，但是后来发现我们更想使用`class component`，所以就慢慢将一些函数写成方法，一些变量改成类属性，外面包一个`class`。实在是太费功夫了。
2. 这个就是一个重构（`vscode`里叫做`refactor`），可以用`typescript plugin`实现的。首先我们用上面`ast`查看工具看看`functional component`和`class component`的节点都是什么东西
3. `functional component`其实是一个`FunctionDeclaration`，`class component`是一个`ClassDeclaration`。要做的东西其实就清晰了，我们要将一个`FunctionDeclaration`转成一个`ClassDeclaration`（或者相反）。
4. 代理`getApplicableRefactors`方法，获取到光标位置的节点（具体可以看代码），然后判断它是不是`FunctionDeclaration`，是则返回这个重构操作名字，比如`MyRefactor`。
5. 代理`getEditsForRefactor`方法，获取到光标位置的节点，判断操作名是不是`MyRefactor`且节点是`FunctionDeclaration`，是则根据`FunctionDeclaration`创建一个`ClassDeclaration`，具体api可以用[ts.factory](https://github.com/microsoft/TypeScript/blob/v4.4.4/lib/typescriptServices.d.ts#L3224)（ts则是上面代码init传入的变量），然后返回重构操作

操作`ast`其实可以参考各种`transformer`，因为原理是一样的。

## 调试配置（暂时只会打log调试）

### vscode
参考[https://github.com/microsoft/TypeScript/wiki/Debugging-Language-Service-in-VS-Code](https://github.com/microsoft/TypeScript/wiki/Debugging-Language-Service-in-VS-Code)
没有试过

### neovim
> 前提是已经lsp已经配置好，以下配置wsl运行通过
1. `npm link` typescript plugin模块链接到全局（即`NODE_PATH`）
2. [built-in-lspconfig](https://github.com/neovim/nvim-lspconfig) `tsserver`配置修改：
```lua
local bin_name = 'typescript-language-server'
local getPath = function (str)
  return str:match("(.*/)")
end
lspconfig.tsserver.setup {
  init_options = { plugins = {{ name = 'ts-plugin-test', location = getPath(os.getenv('NODE_PATH'))} }},
  cmd = { bin_name, '--stdio', '--tsserver-log-file', os.getenv('HOME') .. '/tsserver.log', '--log-level', '3' }
}
```
然后就可以在代码里通过这个[logger模块](https://github.com/microsoft/TypeScript/blob/v4.4.4/lib/tsserverlibrary.d.ts#L6743)来输出日志了。

## 意义
### 对比其他插件：
这个是更通用的方案，在所有支持语言服务器的编辑器都可以收益。

### 重构功能对比`babel-transformer`和`typesccript-transformer`
1. 场景不一样。当我们明确知道需要改动什么，并且要修改`js`或`ts`语法，可以使用`transformer`。如果是一些小优化，或者说是没有强制使用的规范，比如`class component`和`functional component`，我们是根据具体情况使用的，再者是我们要第一时间知道我们的`refactor`具体做了什么，判断`refactor`合理与否，我们需要使用`typescript plugin`
2. `typescript plugin`作用于编辑过程，只需要某个人修改一次就不需要再做处理了。`transformer`每次编译都会处理。

## 一些资源

[关于ast](https://medium.com/basecs/leveling-up-ones-parsing-game-with-asts-d7a6fc2400ff)
[入门demo](https://juejin.cn/post/6942380528456695844) 是带我入门的一篇blog
[lsp specifications](https://microsoft.github.io/language-server-protocol/specifications/specification-current/) `languager server protocol`语言服务协议规范
[Write a typescript plugin](https://github.com/microsoft/TypeScript/wiki/Writing-a-Language-Service-Plugin)官方`typescript plugin`文档，比较简陋
[ast查看器](https://astexplorer.net/) 很有用，编写插件全靠它
[typescript languager server](https://github.com/typescript-language-server/typescript-language-server) 对`tsserver`包装成一个基于`lsp`规范的语言服务器。比较好笑的是，`tsserver`并没有完全按照`lsp`规范，所以需要一层包装。应该是因为先有`tsserver`，然后再从`tsserver`抽离出`lsp`规范。
