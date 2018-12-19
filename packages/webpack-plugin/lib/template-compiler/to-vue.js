const parse = require('../parser')
const compiler = require('./compiler')

function toVue (content, fileName, options) {
  let parts = parse(content, fileName, {})

  try {
    let ret = JSON.parse(parts.json.content)
    options.jsonOptions = ret
  } catch (e) {}

  // root
  if (options.type === 'app') {
    if (!parts.template) {
      // compiler.createComponentBlock(parts, {
      //   type: 'template',
      //   content: "<router-view></router-view>"
      // })
    }
  }

  delete parts.json
  parts = compiler.transpileComponent(parts, options)
  let result = compiler.serializeComponent(parts)

  return result
}

module.exports = toVue
