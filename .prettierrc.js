// Prettier 配置 - 代码风格格式化
export default {
    // 指定每行代码的建议长度，超出换行
    printWidth: 100,
    // 指定每层缩进的空格数
    tabWidth: 4,
    // 是否使用制表符而不是空格缩进
    useTabs: false,
    // 是否在语句末尾添加分号
    semi: true,
    // 是否使用单引号而不是双引号
    singleQuote: true,
    // 是否要求对象的属性名称使用引号
    quoteProps: 'as-needed',
    // 是否在 JSX 中使用单引号而不是双引号
    jsxSingleQuote: false,
    // 是否在多行逗号分隔的语法结构中，在最后一个元素后面添加逗号
    trailingComma: 'es5',
    // 是否在单行对象的括号和内容之间保留一个空格
    bracketSpacing: true,
    // 是否在箭头函数的唯一参数周围添加括号
    arrowParens: 'always',
    // 是否只格式化文件顶部有特殊标记 @format 的文件
    requirePragma: false,
    // 是否更改 Markdown 文本中的换行
    proseWrap: 'preserve',
    // 换行符类型
    endOfLine: 'lf',
    // 是否格式化一些文件中被嵌入的代码片段
    embeddedLanguageFormatting: 'auto',
    // 例外规则
    overrides: [
        // 针对 YAML/JSON 文件使用 2 个空格缩进
        {
            files: '*.{yaml,yml,json}',
            options: {
                tabWidth: 2,
            },
        },
        {
            // Vue 文件使用宽松规则：长行不强制换行，模板风格优先
            files: '*.{vue,html}',
            options: {
                printWidth: 120,
                singleAttributePerLine: false,
                // trailingComma: 'none',
                bracketSameLine: false,
                htmlWhitespaceSensitivity: 'ignore',
                vueIndentScriptAndStyle: false,
            },
        },
    ],
};
