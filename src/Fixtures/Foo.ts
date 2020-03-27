export class Bar {
  get type() {
    return 'bar'
  }
  async doSomething(): Promise<string> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve('did something')
      }, 3000)
    })
  }
}

export class FooFather {
  public age: number = 100
}

export class Foo extends FooFather {
  public name: string = 'foo'
  get message() {
    return 'hello'
  }
  constructor() {
    super()
  }
  getNumber(num: number): number {
    return num
  }
  incrementNumberAsync(num: number): Promise<number> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve(num+1)
      }, 3000)
    })
  }
  async getBar(): Promise<Bar> {
    return new Bar()
  }
}