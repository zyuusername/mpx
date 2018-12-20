const path = require('path')
const hash = require('hash-sum')
const parse = require('./parser')
const createHelpers = require('./helpers')
const loaderUtils = require('loader-utils')
const InjectDependency = require('./dependency/InjectDependency')
const stripExtension = require('./utils/strip-extention')

module.exports = function (content) {
  this.cacheable()
  if (!this._compilation.__mpx__) {
    return content
  }

  const pagesMap = this._compilation.__mpx__.pagesMap
  const componentsMap = this._compilation.__mpx__.componentsMap
  const resource = stripExtension(this.resource)

  const loaderContext = this
  const isProduction = this.minimize || process.env.NODE_ENV === 'production'
  const options = loaderUtils.getOptions(this) || {}

  const filePath = this.resourcePath
  const fileName = path.basename(filePath)

  const context = (
    this.rootContext ||
    (this.options && this.options.context) ||
    process.cwd()
  )
  const shortFilePath = path.relative(context, filePath).replace(/^(\.\.[\\/])+/, '')
  const moduleId = hash(isProduction ? (shortFilePath + '\n' + content) : shortFilePath)

  const needCssSourceMap = (
    !isProduction &&
    this.sourceMap &&
    options.cssSourceMap !== false
  )

  const parts = parse(content, fileName, { needMap: this.sourceMap })
  //
  const hasScoped = parts.styles.some(({ scoped }) => scoped)
  const templateAttrs = parts.template && parts.template.attrs && parts.template.attrs
  const hasComment = templateAttrs && templateAttrs.comments

  let usingComponents = []
  try {
    let ret = JSON.parse(parts.json.content)
    if (ret.usingComponents) {
      usingComponents = Object.keys(ret.usingComponents)
    }
  } catch (e) {
  }

  const {
    getRequire,
    getNamedExports,
    getRequireForSrc,
    getNamedExportsForSrc
  } = createHelpers(
    loaderContext,
    options,
    moduleId,
    parts,
    isProduction,
    hasScoped,
    hasComment,
    usingComponents,
    needCssSourceMap
  )

  // 注入模块id
  const dep = new InjectDependency({
    content: `global.currentModuleId = ${JSON.stringify(moduleId)};\n`,
    index: -3
  })
  this._module.addDependency(dep)
  // 触发webpack global var 注入
  let output = 'global.currentModuleId;\n'

  //
  // <script>
  output += '/* script */\n'
  const script = parts.script
  if (script) {
    output += script.src
      ? (getNamedExportsForSrc('script', script) + '\n')
      : (getNamedExports('script', script) + '\n') + '\n'
  } else {
    if (pagesMap[resource]) {
      // page
      output += 'Page({})' + '\n'
    } else if (componentsMap[resource]) {
      // component
      output += 'Component({})' + '\n'
    } else {
      // app
      output += 'App({})' + '\n'
    }
    output += '\n'
  }

  //
  // <styles>
  output += '/* styles */\n'
  let cssModules
  if (parts.styles.length) {
    let styleInjectionCode = ''
    parts.styles.forEach((style, i) => {
      // require style
      let requireString = style.src
        ? getRequireForSrc('styles', style, style.scoped)
        : getRequire('styles', style, i, style.scoped)

      const hasStyleLoader = requireString.indexOf('style-loader') > -1
      const invokeStyle = code => `${code}\n`

      const moduleName = style.module === true ? '$style' : style.module
      // setCssModule
      if (moduleName) {
        if (!cssModules) {
          cssModules = {}
        }
        if (moduleName in cssModules) {
          loaderContext.emitError(
            'CSS module name "' + moduleName + '" is not unique!'
          )
          styleInjectionCode += invokeStyle(requireString)
        } else {
          cssModules[moduleName] = true

          if (!hasStyleLoader) {
            requireString += '.locals'
          }

          styleInjectionCode += invokeStyle(
            'this["' + moduleName + '"] = ' + requireString
          )
        }
      } else {
        styleInjectionCode += invokeStyle(requireString)
      }
    })
    output += styleInjectionCode + '\n'
  }

  //
  // <json>
  output += '/* json */\n'
  let json = parts.json || {}
  if (json) {
    output += json.src
      ? (getRequireForSrc('json', json) + '\n')
      : (getRequire('json', json) + '\n') + '\n'
  }

  //
  // <template>
  output += '/* template */\n'
  const template = parts.template
  if (template) {
    output += template.src
      ? (getRequireForSrc('template', template) + '\n')
      : (getRequire('template', template) + '\n') + '\n'
  }

  return output
}
