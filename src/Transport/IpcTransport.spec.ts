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

describe('IpcTransport', function() {
  this.timeout(10*1000)
  it('should ', async () => {
    const childProcessScript = path.join(process.cwd(), 'dist', 'Fixtures', 'ChildProcess')
    const child = fork(childProcessScript, [], {
      stdio: ['inherit', 'inherit', 'inherit', 'ipc']
    }) as ChildProcess
    const server = new Server()
    server.add(child)
    server.expose(new Foo(), 'foo')
    child.on('message', (msg) => {
      if (instanceOfAssertionError(msg)) {
        // throw new AssertionError(msg)
        assert.fail(msg.actual, msg.expected, msg.message)
      }
    })
    await onExit(child)
  })
})
