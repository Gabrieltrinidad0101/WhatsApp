export interface IToAndData {
    to?: string
    body?: string
    filename?: string
}

export interface ISendMessage extends  IToAndData {
    instanceId: string
    token: string
    document?: string 
}

export interface ISendMessageUserId extends  ISendMessage {
    isQueue: boolean
    userId: string
}
