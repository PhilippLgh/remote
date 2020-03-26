export interface RpcRequestMessage {
  id: number
  method: string
  params: any[]
}

export const instanceOfRpcRequest = (message: any) : message is RpcRequestMessage => ('method' in message && 'params' in message) 

export interface PartialRpcRequestMessage {
  method: string
  params: any[]
}

export interface ErrorObject {
  message: string
}

export interface RpcResponseMessage {
  id: number
  result: any
  error?: ErrorObject
}

export const instanceOfRpcResponse = (message: any) : message is RpcResponseMessage => ('result' in message || 'error' in message) 