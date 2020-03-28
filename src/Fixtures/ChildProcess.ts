// console.log('child process running')
const { Client, IpcTransport } = require('../index')
const { assert } = require('chai')
const client = new Client()

// returns promise
const evalInContext = (context: any) => (function(){
  // code can use await inside
  const code = `(async function start() { ${process.argv.pop()} })()`
  return eval(code);
}).call(context)

evalInContext(this)
  .then(() => {
    // console.log('code execution finished')
    process.exit(0)
  })
  .catch((error: Error) => {
    // console.log('error in code', error)
    // forward assertion errors
    process.send && process.send({
      'type': 'child_error',
      error: error.message
    })
    setTimeout(() => {
      process.exit(1)
    }, 100)
  })