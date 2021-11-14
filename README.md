# typescript plugin demo

## 术语：
`lsp`: 微软定义的语言服务协议，[https://microsoft.github.io/language-server-protocol/specifications/specification-current](https://microsoft.github.io/language-server-protocol/specifications/specification-current/)

`tsserver`: vscode背后提供智能编辑体验的服务器，[https://github.com/microsoft/TypeScript/wiki/Standalone-Server-%28tsserver%29](https://github.com/microsoft/TypeScript/wiki/Standalone-Server-%28tsserver%29)

`typescript plugin`: tsserver插件，可以用来扩展编辑器服务，比如补全，refactor，[https://github.com/microsoft/TypeScript/wiki/Writing-a-Language-Service-Plugin](https://github.com/microsoft/TypeScript/wiki/Writing-a-Language-Service-Plugin)，可以在tsconfig配置，[https://www.typescriptlang.org/tsconfig#plugins](https://www.typescriptlang.org/tsconfig#plugins)，然后npm安装到vscode语言服务插件目录，我的是在`E:\app\Microsoft VS Code\resources\app\extensions\typescript-language-features\node_modules`

## 开发参考资源

1. 入门认识，[https://juejin.cn/post/6942380528456695844](https://juejin.cn/post/6942380528456695844)
2. [typescript ast查看器](https://astexplorer.net/)
3. 可以参考[typescript-transformer](https://github.com/madou/typescript-transformer-handbook#adding-new-import-declarations)，因为原理基本一样，通过操作ast实现

## 开发简单文档

### lsp基本原理

编辑器前端收到用户的需要语法解析的编辑操作（比如跳转定义，补全）
编辑器前端按照lsp标准发请求给lsp后端（vscode的lsp后端是tsserver）
lsp后端收到并分析返回结果（比如得到补全列表，得到定义位置）
编辑器前端通过自己的ui系统展示结果，并等待用户其他操作

### 简单例子
```
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
info.LanguageService是服务器暴露给我们的api，当编辑器访问一些功能时会调用，比如获取补全列表，获取可以重构提示，跳转定义等。可以跳转到它的类型定义了解更多。
[info.LanguageService定义位置](https://github.com/microsoft/TypeScript/blob/7f004ad8dfd4d3aa047173a890c0beaeb8a307de/lib/tsserverlibrary.d.ts#L4898)
简单介绍一些api：
`getApplicableRefactors`: 获取重构提示，即是返回一些重构操作的选项，供用户选择。vscode可以按`ctrl+shift+R`来弹出这个菜单，
或者点击代码行左边的小灯泡，都会请求服务器，服务器会执行这个api。
`getEditsForRefactor`: 上一步获取到重构操作的名字，当用户确定要执行这个操作时，会请求服务器，然后服务器执行这个api获取重构操作具体要干什么返回编辑器。
`getCompletionsAtPosition`: api补全菜单的获取需要这个

以上的代码例子意思是说可以通过代理这些api来扩展我们需要的操作。我们可以先获取原始api的结果，然后做修改，或者添加。或者不使用原始api的结果，用我们自己的方法。

### 简单编写流程
我们代理这些api后，具体要怎么做才能得到结果呢？一般的流程是：

1. 我们编辑的时候，发现了一个不舒服的地方，比如有时我们写了一个React functional component，但是后来发现我们更想使用Class component，所以就慢慢将一些函数写成方法，一些变量改成类属性，外面包一个class。实在是太费功夫了。
2. 这个就是一个重构（vscode里叫做refactor），可以用typescript plugin实现的。首先我们用上面ast查看工具看看functional component和class component的节点都是什么东西
3. functional class其实是一个FunctionDeclaration，class component是一个ClassDeclaration。要做的东西其实就清晰了，我们要将一个FunctionDeclaration转成一个ClassDeclaration（或者相反）。
4. 代理getApplicableRefactors方法，获取到光标位置的节点（具体可以看代码），然后判断它是不是FunctionDeclaration，是则返回这个重构操作名字，比如MyRefactor。
5. 代理getEditsForRefactor方法，获取到光标位置的节点，判断操作名是不是MyRefactor且节点是FunctionDeclaration，是则根据FunctionDeclaration创建一个ClassDeclaration，具体api可以用ts.factory（ts则是上面代码init传入的变量），然后返回重构操作

操作ast其实可以参考各种transformer，因为原理是一样的。

## 意义
###对比其他插件：
这个是更通用的方案，在所有支持语言服务器的编辑器都可以收益。

### 重构功能对比babel-transformer和typesccript-transformer
1. 场景不一样。当我们明确知道需要改动什么，并且要修改js或ts语法，可以使用transformer。如果是一些小优化，或者说是没有强制使用的规范，比如class component和functional component，我们是根据具体情况使用的，再者是我们要第一时间知道我们的refactor具体做了什么，判断refactor合理与否，我们需要使用typescript plugin
2. typescript plugin作用于编辑过程，只需要某个人修改一次就不需要再做处理了。transformer每次编译都会处理。
