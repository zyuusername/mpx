const path = require('path')
const loaderUtils = require('loader-utils')
const cache = require('./utils/cache')
const toVue = require('./template-compiler/to-vue')
const hash = require('hash-sum')

const hashKeys = []
module.exports = function (content) {
  const filePath = this.resourcePath
  // this.addDependency(this.resourcePath)
  const fileName = path.basename(filePath)
  const resourceQuery = this.resourceQuery || '?'
  const queryObj = loaderUtils.parseQuery(resourceQuery)
  const options = loaderUtils.getOptions(this) || {}
  const rootResource = this._compilation.entries[0].resource

  // vue-loader会在资源query拼接自己的参数，这些参数不由用户拼接
  // 仅以资源名、资源、约定的资源query参数作为hash参数，剔除自动参数
  let hashItems = [filePath, content]
  hashKeys.forEach(i => {
    if (queryObj.hasOwnProperty) {
      hashItems.push(queryObj[i])
    }
  })
  let hashName = this.resourcePath + hash(hashItems.join(''))

  let output = cache.getCache(hashName)
  if (!output) {
    let transpilerOptions = {
      userOptions: queryObj,
      loaderOptions: options
    }
    if (filePath === rootResource) {
      transpilerOptions.type = 'app'
    } else {
      transpilerOptions.type = ''
    }
    output = toVue(content, fileName, transpilerOptions)
    cache.setCache(hashName, output)
  }
  return output
}
