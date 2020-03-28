import { fork, ChildProcess } from 'child_process'
import path from 'path'
import { Server, IpcTransport } from '../index'
import { Foo } from '../Fixtures/Foo'
import { assert } from 'chai'
import { AssertionError } from 'assert'

interface AssertionErrorOptions {
  message?: string; 
  actual?: any; 
  expected?: any;
  operator?: string; 
  stackStartFn?: Function
}

const instanceOfAssertionError = (err: any) : err is AssertionErrorOptions => err && err.stack && err.message && err.expected

const onExit = (proc: ChildProcess) : Promise<number | null> => new Promise((resolve, reject) => {
  proc.on('exit', code => resolve(code))
})

const runInInstrumentedProcess = (code: string) => {
  return async function() {
    const childProcessScript = path.join(process.cwd(), 'dist', 'Fixtures', 'ChildProcess')
    const child = fork(childProcessScript, [code], {
      stdio: ['inherit', 'inherit', 'inherit', 'ipc']
    }) as ChildProcess
    const server = new Server()
    server.add(child)
    server.expose(new Foo(), 'foo')
    child.on('error', (err) => {
      console.log('error in child', err)
    })
    child.on('message', (msg) => {
      if (instanceOfAssertionError(msg)) {
        // throw new AssertionError(msg)
        assert.fail(msg.actual, msg.expected, msg.message)
      }
      else if((<any>msg).type === 'child_error') {
        throw new Error((<any>msg).error)
      } else {
        // console.log('message', msg)
      }
    })
    const exitCode = await onExit(child)
    assert.equal(exitCode, 0, 'ChildProcess error')
  }
}

describe('IpcTransport', function() {
  this.timeout(10*1000)

  it('test #1', runInInstrumentedProcess(`
    const foo = await client.getRemote('foo')
    assert.isDefined(foo)
  `))

  it('test #2', runInInstrumentedProcess(`
    const foo = await client.getRemote('foo')
    assert.equal(await foo.name, 'foo')
  `))

  it('test #3', runInInstrumentedProcess(`
    const foo = await client.getRemote('foo')
    const number = await foo.incrementNumberAsync(42)
    assert.equal(number, 43)
  `))

  it('test #4', runInInstrumentedProcess(`
    const foo = await client.getRemote('foo')
    const n = await foo.addNumberAsync(102)
    assert.equal(n, 112)
  `))

  it('get "age" of parent class', runInInstrumentedProcess(`
    const foo = await client.getRemote('foo')
    const age = await foo.age
    assert.equal(age, 100)
  `))

  it('set "age" of parent class', runInInstrumentedProcess(`
    const foo = await client.getRemote('foo')
    await (foo.age = 50)
    assert.equal(await foo.age, 50)
  `))

})
